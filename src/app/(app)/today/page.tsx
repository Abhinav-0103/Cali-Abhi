import Link from "next/link";
import { AlertTriangle, PartyPopper } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DayCard } from "@/components/plan/day-card";
import { ClearOnboardingDraft } from "@/components/onboarding/clear-draft";
import { TodayWorkout } from "@/components/workout/today-workout";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { WEEKDAYS } from "@/lib/constants";
import { weekdayInTimeZone } from "@/lib/dates";
import { getActivePlan, type PlanView } from "@/lib/plan/queries";
import { nextPlanDay } from "@/lib/workout/logic";
import type { StartableDay } from "@/lib/workout/types";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { supabase, user, profile } = await requireOnboardedProfile();
  const [plan, { data: generating }] = await Promise.all([
    getActivePlan(supabase),
    supabase.from("plans").select("id").eq("status", "generating").maybeSingle(),
  ]);

  return (
    <main className="space-y-4">
      <ClearOnboardingDraft />
      <h1 className="text-2xl font-bold">Today</h1>
      {profile.parq_flagged && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>Conservative mode</AlertTitle>
          <AlertDescription>
            Based on your health answers, please check with a doctor before training hard. Your plan starts gently.
          </AlertDescription>
        </Alert>
      )}

      {generating ? (
        <Card>
          <CardHeader>
            <CardTitle>Your plan is being built</CardTitle>
            <CardDescription>This usually takes under a minute.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/plan/generating">See progress</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Let&rsquo;s build your plan</CardTitle>
            <CardDescription>A 4-week programme based on your answers, ready in about a minute.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/plan/generating">Create my plan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <NextWorkout plan={plan} userId={user.id} timezone={profile.timezone} supabase={supabase} />
      )}
    </main>
  );
}

async function NextWorkout({
  plan,
  userId,
  timezone,
  supabase,
}: {
  plan: PlanView;
  userId: string;
  timezone: string;
  supabase: Awaited<ReturnType<typeof requireOnboardedProfile>>["supabase"];
}) {
  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, status, week_number, day_number, started_at")
    .eq("plan_id", plan.planId)
    .in("status", ["completed", "in_progress"])
    .order("started_at", { ascending: false });
  if (error) throw error;

  const completed = sessions.filter((s) => s.status === "completed");
  const inProgress = sessions.find((s) => s.status === "in_progress");
  const next = nextPlanDay(plan.weeks, completed);
  const totalDays = plan.weeks.reduce((n, w) => n + w.days.length, 0);
  const doneDays = new Set(completed.filter((s) => s.week_number).map((s) => `${s.week_number}-${s.day_number}`)).size;

  if (!next) {
    return (
      <Card>
        <CardHeader>
          <PartyPopper className="size-8 text-primary" aria-hidden />
          <CardTitle>You finished your 4-week plan!</CardTitle>
          <CardDescription>Great work. Generate your next block to keep progressing.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link href="/plan/generating">Create my next plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const startable: StartableDay = {
    planId: plan.planId,
    planDayId: next.day.id,
    weekNumber: next.weekNumber,
    dayNumber: next.day.dayNumber,
    title: next.day.title,
    exercises: next.day.exercises.map((e) => ({
      id: e.id,
      block: e.block,
      exerciseId: e.exerciseId,
      name: e.name,
      metric: e.metric,
      unilateral: e.unilateral,
      cues: e.cues,
      sets: e.sets,
      targetMin: e.targetMin,
      targetMax: e.targetMax,
      restSeconds: e.restSeconds,
      notes: e.notes,
    })),
  };
  const scheduledToday = next.day.weekday === weekdayInTimeZone(timezone);

  return (
    <section aria-labelledby="next-workout" className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <h2 id="next-workout" className="font-medium">
            {scheduledToday ? "Today's workout" : "Next workout"}
          </h2>
          <span className="text-muted-foreground">
            {doneDays}/{totalDays} sessions done
          </span>
        </div>
        <Progress value={(doneDays / totalDays) * 100} aria-label={`${doneDays} of ${totalDays} sessions done`} />
        {!scheduledToday && (
          <p className="text-sm text-muted-foreground">
            Planned for {WEEKDAYS[next.day.weekday]}. Training on a different day is fine.
          </p>
        )}
      </div>
      <TodayWorkout day={startable} userId={userId} serverInProgressId={inProgress?.id ?? null} />
      <DayCard day={next.day} />
    </section>
  );
}
