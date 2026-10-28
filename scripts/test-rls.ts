// RLS smoke test against the LOCAL Supabase stack (pnpm db:start).
// Proves users can only touch their own rows and server-only objects are locked.
// Usage: pnpm db:test-rls
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
if (!url.includes("127.0.0.1") && !url.includes("localhost")) throw new Error("Refusing to run against a non-local database");

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function signedInUser(): Promise<{ id: string; client: SupabaseClient }> {
  const email = `rls-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

async function main() {
  const a = await signedInUser();
  const b = await signedInUser();

  // profile row created by trigger, visible only to its owner
  const ownProfile = await a.client.from("profiles").select("id").eq("id", a.id);
  check("profile auto-created and readable by owner", ownProfile.data?.length === 1, ownProfile.error);
  const otherProfile = await b.client.from("profiles").select("id").eq("id", a.id);
  check("other user's profile is invisible", otherProfile.data?.length === 0, otherProfile.error);
  const otherProfileUpdate = await b.client.from("profiles").update({ timezone: "X" }).eq("id", a.id).select();
  check("cannot update other user's profile", otherProfileUpdate.data?.length === 0, otherProfileUpdate.error);

  // logging tables
  const weight = await a.client.from("body_weight_logs").insert({ user_id: a.id, logged_on: "2026-01-01", weight_kg: 70 }).select().single();
  check("owner can insert body weight", !weight.error, weight.error);
  const forged = await b.client.from("body_weight_logs").insert({ user_id: a.id, logged_on: "2026-01-02", weight_kg: 70 });
  check("cannot insert rows for another user", Boolean(forged.error));
  const readOther = await b.client.from("body_weight_logs").select("id").eq("user_id", a.id);
  check("cannot read another user's weight logs", readOther.data?.length === 0, readOther.error);
  const delOther = await b.client.from("body_weight_logs").delete().eq("id", weight.data!.id).select();
  check("cannot delete another user's rows", delOther.data?.length === 0, delOther.error);

  // composite FK: cannot attach a child row to another user's session
  const sessionId = randomUUID();
  const session = await a.client.from("workout_sessions").insert({
    id: sessionId, user_id: a.id, performed_on: "2026-01-01", started_at: new Date().toISOString(),
    progression_applied_at: new Date().toISOString(),
  }).select().single();
  check("owner can create a workout session", !session.error, session.error);
  check("client cannot set the server-owned progression flag", session.data?.progression_applied_at === null, session.data);
  const hijack = await b.client.from("session_exercises").insert({
    id: randomUUID(), session_id: sessionId, user_id: b.id, exercise_id: "push_up", position: 1,
    planned_sets: 3, target_min: 5, target_max: 8,
  });
  check("cannot attach exercises to another user's session", Boolean(hijack.error));

  // server-written tables are read-only for users
  const planInsert = await a.client.from("plans").insert({ user_id: a.id });
  check("users cannot write plans directly", Boolean(planInsert.error));
  const checkinInsert = await a.client.from("weekly_checkins").insert({
    user_id: a.id, plan_id: randomUUID(), week_number: 1, energy: 3, soreness: 3, difficulty: 3, source: "rules",
  });
  check("users cannot write check-ins directly", Boolean(checkinInsert.error));

  const eventInsert = await a.client.from("progression_events").insert({
    user_id: a.id, plan_id: randomUUID(), session_id: sessionId, exercise_id: "push_up", decision: "add_set", message: "x",
  });
  check("users cannot write progression events", Boolean(eventInsert.error));

  // server-only tables and functions
  const usage = await a.client.from("ai_usage").select("id");
  check("ai_usage is not readable by users", Boolean(usage.error) || usage.data?.length === 0, usage.error);
  const quota = await a.client.from("ai_quota").insert({ user_id: a.id, kind: "plan", window_start: "2026-01-01", count: -100 });
  check("ai_quota is not writable by users", Boolean(quota.error));
  const rpc = await a.client.rpc("consume_ai_quota", { p_user_id: a.id, p_kind: "plan", p_limit: 999, p_window: "day" });
  check("users cannot call consume_ai_quota", Boolean(rpc.error));
  const saveRpc = await a.client.rpc("save_plan_version", { p_user_id: a.id, p_plan_id: randomUUID(), p_reason: "initial", p_summary: "", p_weeks: [] });
  check("users cannot call save_plan_version", Boolean(saveRpc.error));

  // quota function works for the server and enforces the limit
  const q = [];
  for (let i = 0; i < 4; i++) {
    q.push((await admin.rpc("consume_ai_quota", { p_user_id: a.id, p_kind: "plan", p_limit: 3, p_window: "day" })).data);
  }
  check("quota allows 3 then refuses", JSON.stringify(q) === "[true,true,true,false]", q);

  // exercise library readable, not writable
  const ex = await a.client.from("exercises").select("id", { count: "exact", head: true });
  check("exercise library readable by users", (ex.count ?? 0) >= 80, ex.error);
  const exWrite = await a.client.from("exercises").update({ name: "hacked" }).eq("id", "push_up").select();
  check("exercise library not writable by users", exWrite.data?.length === 0 || Boolean(exWrite.error), exWrite.data);

  // anonymous visitors see nothing
  const anon = createClient(url, publishableKey, { auth: { persistSession: false } });
  const anonEx = await anon.from("exercises").select("id");
  check("anonymous users cannot read data", anonEx.data?.length === 0 || Boolean(anonEx.error), anonEx.data?.length);

  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
  const leftovers = await admin.from("body_weight_logs").select("id").eq("user_id", a.id);
  check("deleting a user cascades their data", leftovers.data?.length === 0, leftovers.data);

  if (failures) {
    console.error(`\n${failures} RLS check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll RLS checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
