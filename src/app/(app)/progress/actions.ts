"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { fieldErrors, historyCursorSchema, retestSchema, weightEntrySchema } from "@/lib/schemas/progress";

export type FormResult = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

export async function logWeight(raw: unknown): Promise<FormResult> {
  const parsed = weightEntrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the highlighted field.", errors: fieldErrors(parsed.error) };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("body_weight_logs")
    .upsert(
      { user_id: user.id, logged_on: parsed.data.date, weight_kg: parsed.data.weightKg },
      { onConflict: "user_id,logged_on" },
    );
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  revalidatePath("/progress");
  return { ok: true };
}

export async function logRetest(raw: unknown): Promise<FormResult> {
  const parsed = retestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { supabase, user } = await requireUser();
  const d = parsed.data;
  const { error } = await supabase.from("baseline_tests").insert({
    user_id: user.id,
    tested_on: d.date,
    push_ups: d.pushUps,
    pull_ups: d.pullUps,
    squats: d.squats,
    plank_seconds: d.plankSeconds,
    dead_hang_seconds: d.deadHangSeconds,
    source: "retest",
  });
  if (error) return { ok: false, message: "Couldn't save. Please try again." };
  revalidatePath("/progress");
  return { ok: true };
}

export type HistoryItem = { id: string; performedOn: string; title: string; sets: number; minutes: number | null };
const HISTORY_PAGE_SIZE = 10;

/** One page of completed workouts, newest first (keyset pagination on performed_on, id). */
export async function loadHistory(rawCursor?: unknown): Promise<{ items: HistoryItem[]; hasMore: boolean }> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("workout_sessions")
    .select("id, performed_on, started_at, completed_at, plan_days(title), session_exercises(set_logs(count))")
    .eq("status", "completed")
    .order("performed_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_PAGE_SIZE + 1);

  if (rawCursor !== undefined) {
    const cursor = historyCursorSchema.parse(rawCursor);
    query = query.or(`performed_on.lt.${cursor.date},and(performed_on.eq.${cursor.date},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw error;

  const items = data.slice(0, HISTORY_PAGE_SIZE).map((s) => ({
    id: s.id,
    performedOn: s.performed_on,
    title: s.plan_days?.title ?? "Workout",
    sets: s.session_exercises.reduce((n, e) => n + (e.set_logs[0]?.count ?? 0), 0),
    minutes: s.completed_at ? Math.max(1, Math.round((Date.parse(s.completed_at) - Date.parse(s.started_at)) / 60000)) : null,
  }));
  return { items, hasMore: data.length > HISTORY_PAGE_SIZE };
}
