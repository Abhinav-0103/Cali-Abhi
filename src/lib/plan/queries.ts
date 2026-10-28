import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Block, Metric } from "@/lib/constants";
import { formatTarget } from "@/lib/workout/logic";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PlanViewExercise = {
  id: string;
  position: number;
  block: Block;
  exerciseId: string;
  name: string;
  metric: Metric;
  unilateral: boolean;
  cues: string[];
  sets: number;
  targetMin: number;
  targetMax: number;
  restSeconds: number;
  notes: string | null;
};
export type PlanViewDay = { id: string; dayNumber: number; weekday: number; title: string; focus: string | null; exercises: PlanViewExercise[] };
export type PlanViewWeek = { weekNumber: number; focus: string | null; days: PlanViewDay[] };
export type PlanView = {
  planId: string;
  versionId: string;
  version: number;
  source: "ai" | "template" | null;
  startDate: string | null;
  summary: string | null;
  weeks: PlanViewWeek[];
};

/** The user's active plan at its current version, fully nested and sorted. RLS scopes it to the user. */
export async function getActivePlan(supabase: Supabase): Promise<PlanView | null> {
  const { data, error } = await supabase
    .from("plans")
    .select(
      `id, source, start_date,
       plan_versions!inner ( id, version, summary, is_current,
         plan_weeks ( week_number, focus,
           plan_days ( id, day_number, weekday, title, focus,
             plan_exercises ( id, position, block, exercise_id, sets, target_min, target_max, rest_seconds, notes,
               exercises ( name, metric, unilateral, cues ) ) ) ) )`,
    )
    .eq("status", "active")
    .eq("plan_versions.is_current", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const version = data.plan_versions[0];
  return {
    planId: data.id,
    versionId: version.id,
    version: version.version,
    source: data.source as PlanView["source"],
    startDate: data.start_date,
    summary: version.summary,
    weeks: version.plan_weeks
      .map((w) => ({
        weekNumber: w.week_number,
        focus: w.focus,
        days: w.plan_days
          .map((d) => ({
            id: d.id,
            dayNumber: d.day_number,
            weekday: d.weekday,
            title: d.title,
            focus: d.focus,
            exercises: d.plan_exercises
              .map((e) => ({
                id: e.id,
                position: e.position,
                block: e.block as Block,
                exerciseId: e.exercise_id,
                name: e.exercises!.name,
                metric: e.exercises!.metric as Metric,
                unilateral: e.exercises!.unilateral,
                cues: e.exercises!.cues,
                sets: e.sets,
                targetMin: e.target_min,
                targetMax: e.target_max,
                restSeconds: e.rest_seconds,
                notes: e.notes,
              }))
              .sort((a, b) => a.position - b.position),
          }))
          .sort((a, b) => a.dayNumber - b.dayNumber),
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber),
  };
}

export function formatPlanTarget(e: Pick<PlanViewExercise, "metric" | "targetMin" | "targetMax" | "unilateral">) {
  return formatTarget(e.targetMin, e.targetMax, e.metric, e.unilateral);
}
