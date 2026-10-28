import type { createClient } from "@/lib/supabase/client";
import type { Metric } from "@/lib/constants";
import { formatTarget } from "@/lib/workout/logic";
import type { LocalWorkout } from "@/lib/workout/types";
import { allWorkouts, getWorkout, putWorkout } from "./db";

type Supabase = ReturnType<typeof createClient>;

export const SYNCED_EVENT = "calicoach:workout-synced";
export type SyncedDetail = { sessionId: string; syncedRev: number; clearedDeletes: string[]; session: LocalWorkout["session"] };

const UNIQUE_VIOLATION = "23505";

/**
 * Pushes one workout to Supabase. Every write is an upsert keyed by ids made
 * on the device, so pushing the same state twice is harmless.
 */
async function pushWorkout(supabase: Supabase, w: LocalWorkout): Promise<LocalWorkout["session"]> {
  let session = w.session;
  let res = await supabase.from("workout_sessions").upsert(session);
  if (res.error?.code === UNIQUE_VIOLATION && session.status === "completed") {
    // The same plan day was already completed (e.g. on another device):
    // keep this workout as an extra session instead of failing forever.
    session = { ...session, week_number: null, day_number: null };
    res = await supabase.from("workout_sessions").upsert(session);
  }
  if (res.error) throw res.error;

  if (w.exercises.length > 0) {
    const { error } = await supabase.from("session_exercises").upsert(
      w.exercises.map((e) => ({
        id: e.id,
        session_id: session.id,
        user_id: session.user_id,
        exercise_id: e.exercise_id,
        plan_exercise_id: e.plan_exercise_id,
        position: e.position,
        planned_sets: e.planned_sets,
        target_min: e.target_min,
        target_max: e.target_max,
        rpe: e.rpe,
        skipped: e.skipped,
      })),
    );
    if (error) throw error;
  }

  if (w.deletedSetIds.length > 0) {
    const { error } = await supabase.from("set_logs").delete().in("id", w.deletedSetIds);
    if (error) throw error;
  }

  if (w.sets.length > 0) {
    // Conflict on (exercise, set number): last write wins, even if two devices
    // logged the same set with different ids while offline.
    const { error } = await supabase.from("set_logs").upsert(
      w.sets.map((s) => ({ ...s, user_id: session.user_id })),
      { onConflict: "session_exercise_id,set_number" },
    );
    if (error) throw error;
  }
  return session;
}

let running: Promise<void> | null = null;

/** Syncs every workout on this device that has unsynced changes. Safe to call often. */
export function syncDirtyWorkouts(supabase: Supabase): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();
  running ??= (async () => {
    try {
      for (const w of await allWorkouts()) {
        if (w.rev <= w.syncedRev) continue;
        const session = await pushWorkout(supabase, w);
        // Re-read: the user may have logged more while we were pushing.
        const latest = (await getWorkout(w.session.id)) ?? w;
        const updated: LocalWorkout = {
          ...latest,
          session: { ...latest.session, week_number: session.week_number, day_number: session.day_number },
          syncedRev: Math.max(latest.syncedRev, w.rev),
          deletedSetIds: latest.deletedSetIds.filter((id) => !w.deletedSetIds.includes(id)),
        };
        await putWorkout(updated);
        window.dispatchEvent(
          new CustomEvent<SyncedDetail>(SYNCED_EVENT, {
            detail: { sessionId: w.session.id, syncedRev: updated.syncedRev, clearedDeletes: w.deletedSetIds, session: updated.session },
          }),
        );
      }
    } catch (error) {
      console.warn("workout sync failed; will retry", error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Loads a workout from Supabase (e.g. started on another device). */
export async function fetchWorkout(supabase: Supabase, sessionId: string): Promise<LocalWorkout | null> {
  const { data: session, error } = await supabase
    .from("workout_sessions")
    .select("id, user_id, plan_id, plan_day_id, week_number, day_number, status, performed_on, started_at, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const [exercisesRes, dayRes] = await Promise.all([
    supabase
      .from("session_exercises")
      .select(
        "id, exercise_id, plan_exercise_id, position, planned_sets, target_min, target_max, rpe, skipped, exercises(name, metric, unilateral, cues), plan_exercises(rest_seconds, notes), set_logs(id, session_exercise_id, set_number, value, logged_at)",
      )
      .eq("session_id", sessionId)
      .order("position"),
    session.plan_day_id
      ? supabase
          .from("plan_days")
          .select("title, plan_exercises(block, position, target_min, target_max, exercises(name, metric, unilateral))")
          .eq("id", session.plan_day_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (exercisesRes.error) throw exercisesRes.error;
  if (dayRes.error) throw dayRes.error;

  const mobility = (block: string) =>
    (dayRes.data?.plan_exercises ?? [])
      .filter((p) => p.block === block)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        name: p.exercises!.name,
        target: formatTarget(p.target_min, p.target_max, p.exercises!.metric as Metric, p.exercises!.unilateral),
      }));

  return {
    session: session as LocalWorkout["session"],
    title: dayRes.data?.title ?? "Workout",
    warmup: mobility("warmup"),
    cooldown: mobility("cooldown"),
    exercises: exercisesRes.data.map((e) => ({
      id: e.id,
      exercise_id: e.exercise_id,
      plan_exercise_id: e.plan_exercise_id,
      position: e.position,
      planned_sets: e.planned_sets,
      target_min: e.target_min,
      target_max: e.target_max,
      rpe: e.rpe,
      skipped: e.skipped,
      name: e.exercises!.name,
      metric: e.exercises!.metric as Metric,
      unilateral: e.exercises!.unilateral,
      cues: e.exercises!.cues,
      rest_seconds: e.plan_exercises?.rest_seconds ?? 90,
      notes: e.plan_exercises?.notes ?? null,
    })),
    sets: exercisesRes.data.flatMap((e) => e.set_logs),
    deletedSetIds: [],
    rev: 1,
    syncedRev: 1,
  };
}
