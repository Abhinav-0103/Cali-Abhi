import "server-only";
import type { BodyPart, Equipment, Experience } from "@/lib/constants";
import { filterExercises } from "@/lib/exercises/filter";
import type { Exercise } from "@/lib/exercises/library";
import type { StoredPlanWeek } from "@/lib/plan/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { applyDecisions } from "./apply";
import { chainNeighbours, decideProgression, describeDecision, type Decision, type ExerciseResult } from "./engine";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Runs the progression engine for one completed session and stores any plan
 * changes as a new plan version. Idempotent: each session is processed once
 * (claimed via workout_sessions.progression_applied_at). Returns the change
 * messages recorded for this session.
 */
export async function processSession(userId: string, sessionId: string): Promise<string[]> {
  const admin = createAdminClient();

  const { data: claimed, error: claimError } = await admin
    .from("workout_sessions")
    .update({ progression_applied_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .is("progression_applied_at", null)
    .select("id, plan_id")
    .maybeSingle();
  if (claimError) throw claimError;

  if (claimed?.plan_id) {
    try {
      await progress(admin, userId, claimed.plan_id, sessionId);
    } catch (error) {
      // Release the claim so it can be retried later.
      await admin.from("workout_sessions").update({ progression_applied_at: null }).eq("id", sessionId);
      throw error;
    }
  }

  const { data: events } = await admin
    .from("progression_events")
    .select("message")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at");
  return (events ?? []).map((e) => e.message);
}

/** Processes completed sessions that were never processed (e.g. the app closed before it could). */
export async function processPendingSessions(userId: string, planId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "completed")
    .is("progression_applied_at", null)
    .order("completed_at");
  for (const s of data ?? []) {
    try {
      await processSession(userId, s.id);
    } catch (error) {
      console.error("progression failed for session", s.id, error);
    }
  }
}

async function progress(admin: Admin, userId: string, planId: string, sessionId: string) {
  const { data: plan } = await admin.from("plans").select("id, status").eq("id", planId).eq("user_id", userId).maybeSingle();
  if (plan?.status !== "active") return; // old plans don't change

  const [profileRes, libraryRes, sessionExercisesRes] = await Promise.all([
    admin.from("profiles").select("equipment, injury_areas, experience, parq_flagged").eq("id", userId).single(),
    admin.from("exercises").select("*"),
    admin.from("session_exercises").select("exercise_id").eq("session_id", sessionId).eq("user_id", userId),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (libraryRes.error) throw libraryRes.error;
  if (sessionExercisesRes.error) throw sessionExercisesRes.error;

  const library = libraryRes.data as Exercise[];
  const byId = new Map(library.map((e) => [e.id, e]));
  const names = new Map(library.map((e) => [e.id, e.name]));
  const profile = profileRes.data;
  const eligible = filterExercises(library, {
    equipment: profile.equipment as Equipment[],
    injuryAreas: profile.injury_areas as BodyPart[],
    experience: profile.experience as Experience,
    conservative: profile.parq_flagged ?? false,
  });
  const exerciseIds = [...new Set(sessionExercisesRes.data.map((e) => e.exercise_id))];
  if (exerciseIds.length === 0) return;

  const histories = await loadHistories(admin, userId, planId, exerciseIds);

  const decisions: { exerciseId: string; decision: Decision; message: string }[] = [];
  for (const exerciseId of exerciseIds) {
    const current = byId.get(exerciseId);
    if (!current || current.category === "mobility") continue;
    const decision = decideProgression(histories.get(exerciseId) ?? [], { current, ...chainNeighbours(current, eligible) });
    const message = describeDecision(decision, current, names);
    if (message) decisions.push({ exerciseId, decision, message });
  }
  if (decisions.length === 0) return;

  // Retry if another request saved a newer version while we were working.
  for (let attempt = 0; attempt < 3; attempt++) {
    const version = await loadCurrentVersion(admin, planId);
    if (!version) return;
    const completedKeys = await completedDayKeys(admin, userId, planId);

    let weeks = version.weeks;
    const applied: typeof decisions = [];
    for (const d of decisions) {
      const result = applyDecisions(weeks, [d], completedKeys, byId);
      if (result.changed) {
        weeks = result.weeks;
        applied.push(d);
      }
    }
    if (applied.length === 0) return;

    const stillCurrent = await loadCurrentVersion(admin, planId, true);
    if (stillCurrent?.id !== version.id) continue;

    const saved = await admin.rpc("save_plan_version", {
      p_user_id: userId,
      p_plan_id: planId,
      p_reason: "progression",
      p_summary: applied.map((d) => d.message).join("\n"),
      p_weeks: weeks as unknown as Json,
      p_parent_version_id: version.id,
    });
    if (saved.error) throw saved.error;

    const { error } = await admin.from("progression_events").insert(
      applied.map((d) => ({
        user_id: userId,
        plan_id: planId,
        session_id: sessionId,
        exercise_id: d.exerciseId,
        decision: d.decision.type,
        to_exercise_id: "toExerciseId" in d.decision ? d.decision.toExerciseId : null,
        message: d.message,
        version_id: saved.data,
      })),
    );
    if (error) throw error;
    return;
  }
  throw new Error("Plan kept changing while applying progression");
}

/**
 * Results per exercise in this plan, newest first, only since the last
 * progression change that involved that exercise (so evidence isn't reused).
 */
async function loadHistories(admin: Admin, userId: string, planId: string, exerciseIds: string[]) {
  const [rowsRes, eventsRes] = await Promise.all([
    admin
      .from("session_exercises")
      .select(
        "exercise_id, planned_sets, target_min, target_max, rpe, skipped, set_logs(set_number, value), workout_sessions!inner(completed_at, status, plan_id)",
      )
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds)
      .eq("workout_sessions.plan_id", planId)
      .eq("workout_sessions.status", "completed"),
    admin
      .from("progression_events")
      .select("exercise_id, to_exercise_id, workout_sessions(completed_at)")
      .eq("user_id", userId)
      .eq("plan_id", planId),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const cutoff = new Map<string, string>();
  for (const e of eventsRes.data) {
    const at = e.workout_sessions?.completed_at;
    if (!at) continue;
    for (const id of [e.exercise_id, e.to_exercise_id]) {
      if (id && (!cutoff.has(id) || at > cutoff.get(id)!)) cutoff.set(id, at);
    }
  }

  const histories = new Map<string, (ExerciseResult & { at: string })[]>();
  for (const row of rowsRes.data) {
    const at = row.workout_sessions.completed_at;
    if (!at) continue;
    const since = cutoff.get(row.exercise_id);
    if (since && at <= since) continue;
    const list = histories.get(row.exercise_id) ?? [];
    list.push({
      at,
      plannedSets: row.planned_sets,
      targetMin: row.target_min,
      targetMax: row.target_max,
      values: [...row.set_logs].sort((a, b) => a.set_number - b.set_number).map((s) => s.value),
      rpe: row.rpe,
      skipped: row.skipped,
    });
    histories.set(row.exercise_id, list);
  }
  for (const list of histories.values()) list.sort((a, b) => b.at.localeCompare(a.at));
  return histories;
}

async function completedDayKeys(admin: Admin, userId: string, planId: string) {
  const { data, error } = await admin
    .from("workout_sessions")
    .select("week_number, day_number")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "completed");
  if (error) throw error;
  return new Set(data.filter((s) => s.week_number).map((s) => `${s.week_number}-${s.day_number}`));
}

async function loadCurrentVersion(admin: Admin, planId: string, idOnly = false): Promise<{ id: string; weeks: StoredPlanWeek[] } | null> {
  if (idOnly) {
    const { data } = await admin.from("plan_versions").select("id").eq("plan_id", planId).eq("is_current", true).maybeSingle();
    return data ? { id: data.id, weeks: [] } : null;
  }
  const { data, error } = await admin
    .from("plan_versions")
    .select(
      "id, plan_weeks(week_number, focus, plan_days(day_number, weekday, title, focus, plan_exercises(position, block, exercise_id, sets, target_min, target_max, rest_seconds, notes)))",
    )
    .eq("plan_id", planId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    weeks: data.plan_weeks
      .sort((a, b) => a.week_number - b.week_number)
      .map((w) => ({
        week_number: w.week_number,
        focus: w.focus ?? "",
        days: w.plan_days
          .sort((a, b) => a.day_number - b.day_number)
          .map((d) => ({
            day_number: d.day_number,
            weekday: d.weekday,
            title: d.title,
            focus: d.focus ?? "",
            exercises: d.plan_exercises
              .sort((a, b) => a.position - b.position)
              .map((e) => ({
                block: e.block as "warmup" | "main" | "cooldown",
                exercise_id: e.exercise_id,
                sets: e.sets,
                target_min: e.target_min,
                target_max: e.target_max,
                rest_seconds: e.rest_seconds,
                notes: e.notes,
              })),
          })),
      })),
  };
}
