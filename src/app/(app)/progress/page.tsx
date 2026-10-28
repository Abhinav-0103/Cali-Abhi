import { Flame, Medal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdherenceChart } from "@/components/progress/charts";
import { BaselineSection } from "@/components/progress/baseline-section";
import { HistoryList } from "@/components/progress/history-list";
import { WeightSection } from "@/components/progress/weight-section";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { dateInTimeZone, shortDate } from "@/lib/dates";
import { addDays, weekStreak, weeklyAdherence } from "@/lib/progress/stats";
import { loadHistory } from "./actions";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { supabase, profile } = await requireOnboardedProfile();
  const today = dateInTimeZone(profile.timezone);
  const yearAgo = addDays(today, -365);
  const target = profile.days_per_week ?? 3;

  const [sessionsRes, totalRes, baselineRes, weightRes, bestsRes, exercisesRes, history] = await Promise.all([
    supabase.from("workout_sessions").select("performed_on").eq("status", "completed").gte("performed_on", yearAgo).limit(1000),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase
      .from("baseline_tests")
      .select("tested_on, push_ups, pull_ups, squats, plank_seconds, dead_hang_seconds")
      .order("tested_on")
      .order("created_at")
      .limit(100),
    supabase.from("body_weight_logs").select("logged_on, weight_kg").gte("logged_on", yearAgo).order("logged_on").limit(400),
    supabase.from("personal_bests").select("exercise_id, best_value, achieved_on").order("achieved_on", { ascending: false }).limit(30),
    supabase.from("exercises").select("id, name, metric, unilateral"),
    loadHistory(),
  ]);
  for (const res of [sessionsRes, totalRes, baselineRes, weightRes, bestsRes, exercisesRes]) if (res.error) throw res.error;

  const dates = sessionsRes.data!.map((s) => s.performed_on);
  const weeks = weeklyAdherence(dates, target, today, 8);
  const thisWeek = weeks.at(-1)!;
  const streak = weekStreak(dates, target, today);
  const exercises = new Map(exercisesRes.data!.map((e) => [e.id, e]));
  const bests = bestsRes.data!.filter((b) => b.exercise_id && exercises.has(b.exercise_id) && b.best_value);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Progress</h1>

      <section aria-label="Summary" className="grid grid-cols-3 gap-3">
        <div className="col-span-3 flex items-center gap-4 rounded-xl border bg-card p-4">
          <Flame className="size-10 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-muted-foreground">Week streak</p>
            <p className="text-5xl font-semibold">{streak}</p>
            <p className="text-xs text-muted-foreground">
              {streak === 0 ? `Hit ${target} workouts in a week to start one` : `weeks in a row with ${target}+ workouts`}
            </p>
          </div>
        </div>
        <Stat label="This week" value={`${thisWeek.completed}/${target}`} note={`${thisWeek.percent}% adherence`} />
        <Stat label="8-week average" value={`${Math.round(weeks.reduce((n, w) => n + w.percent, 0) / weeks.length)}%`} note="adherence" />
        <Stat label="Workouts" value={String(totalRes.count ?? 0)} note="completed" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Weekly adherence</CardTitle>
          <CardDescription>Completed workouts vs your target of {target} per week</CardDescription>
        </CardHeader>
        <CardContent>
          <AdherenceChart weeks={weeks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baseline tests</CardTitle>
          <CardDescription>Your max effort on the five onboarding tests</CardDescription>
        </CardHeader>
        <CardContent>
          <BaselineSection tests={baselineRes.data!} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body weight</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightSection
            unitSystem={profile.unit_system as "metric" | "imperial"}
            logs={weightRes.data!.map((w) => ({ logged_on: w.logged_on, weight_kg: Number(w.weight_kg) }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="size-4 text-primary" aria-hidden /> Personal bests
          </CardTitle>
          <CardDescription>Best single set per exercise</CardDescription>
        </CardHeader>
        <CardContent>
          {bests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Finish a workout to set your first personal bests.</p>
          ) : (
            <ul className="divide-y text-sm">
              {bests.map((b) => {
                const e = exercises.get(b.exercise_id!)!;
                return (
                  <li key={b.exercise_id} className="flex justify-between py-2">
                    <span>{e.name}</span>
                    <span className="text-right">
                      <span className="font-medium tabular-nums">
                        {b.best_value} {e.metric === "reps" ? "reps" : "s"}
                        {e.unilateral && " per side"}
                      </span>
                      <span className="block text-xs text-muted-foreground">{shortDate(b.achieved_on!)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workout history</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryList initial={history.items} initialHasMore={history.hasMore} />
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
