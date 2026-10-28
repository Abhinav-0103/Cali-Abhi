import { after, NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { runPlanGeneration } from "@/lib/plan/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Plan generation runs after the response, within this function's time limit.
export const maxDuration = 300;

// A "generating" plan older than this is assumed dead (function timed out).
const STALE_AFTER_MS = 6 * 60 * 1000;

/**
 * Starts generating a new plan. Returns 202 with the plan id; the client polls
 * the plan's status. Idempotent while a generation is already running.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("onboarding_completed_at").eq("id", user.id).single();
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: running } = await admin
    .from("plans")
    .select("id, created_at")
    .eq("user_id", user.id)
    .eq("status", "generating")
    .maybeSingle();
  if (running) {
    if (Date.now() - Date.parse(running.created_at) < STALE_AFTER_MS) {
      return NextResponse.json({ planId: running.id }, { status: 202 });
    }
    await admin.from("plans").update({ status: "failed", error: "Timed out" }).eq("id", running.id);
  }

  const quota = await admin.rpc("consume_ai_quota", {
    p_user_id: user.id,
    p_kind: "plan",
    p_limit: serverEnv().AI_PLAN_DAILY_LIMIT,
    p_window: "day",
  });
  if (quota.error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  if (!quota.data) {
    return NextResponse.json(
      { error: `You can generate up to ${serverEnv().AI_PLAN_DAILY_LIMIT} plans per day. Please try again tomorrow.` },
      { status: 429 },
    );
  }

  const { data: plan, error } = await admin.from("plans").insert({ user_id: user.id }).select("id").single();
  if (error) {
    // Lost a race with a parallel request: reuse the plan it started.
    const { data: other } = await admin.from("plans").select("id").eq("user_id", user.id).eq("status", "generating").maybeSingle();
    if (other) return NextResponse.json({ planId: other.id }, { status: 202 });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  after(() => runPlanGeneration(user.id, plan.id));
  return NextResponse.json({ planId: plan.id }, { status: 202 });
}
