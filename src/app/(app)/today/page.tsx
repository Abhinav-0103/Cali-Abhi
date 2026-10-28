import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClearOnboardingDraft } from "@/components/onboarding/clear-draft";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { GOAL_LABELS } from "@/lib/labels";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { profile } = await requireOnboardedProfile();

  return (
    <main className="space-y-4">
      <ClearOnboardingDraft />
      <h1 className="text-2xl font-bold">Today</h1>
      {profile.parq_flagged && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>Conservative mode</AlertTitle>
          <AlertDescription>
            Based on your health answers, please check with a doctor before training hard. Your plan will start
            gently.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>You&rsquo;re all set up</CardTitle>
          <CardDescription>
            Goal: {profile.goal ? GOAL_LABELS[profile.goal as keyof typeof GOAL_LABELS].label : "—"} ·{" "}
            {profile.days_per_week} days a week · {profile.minutes_per_session} min
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Plan generation arrives in phase 3. Your workouts will appear here.
        </CardContent>
      </Card>
    </main>
  );
}
