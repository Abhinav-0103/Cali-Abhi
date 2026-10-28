import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DayCard } from "@/components/plan/day-card";
import { ClearOnboardingDraft } from "@/components/onboarding/clear-draft";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getActivePlan } from "@/lib/plan/queries";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { supabase, profile } = await requireOnboardedProfile();
  const [plan, { data: generating }] = await Promise.all([
    getActivePlan(supabase),
    supabase.from("plans").select("id").eq("status", "generating").maybeSingle(),
  ]);

  // Until workout logging (phase 4) the first day of the plan is the next workout.
  const nextDay = plan?.weeks[0]?.days[0];

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
        nextDay && (
          <section aria-labelledby="next-workout" className="space-y-2">
            <h2 id="next-workout" className="text-sm font-medium text-muted-foreground">
              Next workout
            </h2>
            <DayCard day={nextDay} />
            <p className="text-sm text-muted-foreground">Workout logging arrives in phase 4.</p>
          </section>
        )
      )}
    </main>
  );
}
