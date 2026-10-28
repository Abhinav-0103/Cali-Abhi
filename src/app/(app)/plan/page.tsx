import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayCard } from "@/components/plan/day-card";
import { DisclaimerFooter } from "@/components/disclaimer";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getActivePlan } from "@/lib/plan/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Your plan" };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { supabase } = await requireOnboardedProfile();
  const plan = await getActivePlan(supabase);
  const { week: weekParam, new: isNew } = await searchParams;

  if (!plan) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Your plan</h1>
        <Card>
          <CardContent className="space-y-4">
            <p>You don&rsquo;t have a plan yet.</p>
            <Button asChild>
              <Link href="/plan/generating">Create my plan</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const weekNumber = Math.min(Math.max(Number(weekParam) || 1, 1), plan.weeks.length);
  const week = plan.weeks.find((w) => w.weekNumber === weekNumber)!;

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{isNew ? "Your plan is ready" : "Your plan"}</h1>
        <p className="text-sm text-muted-foreground">
          4 weeks
          {plan.startDate && ` · started ${new Date(`${plan.startDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
          {plan.version > 1 && ` · updated ${plan.version - 1}×`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Why this plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>{plan.summary}</p>
          {plan.source === "template" && (
            <Badge variant="secondary">Built from our standard template</Badge>
          )}
        </CardContent>
      </Card>

      <nav aria-label="Weeks" className="grid grid-cols-4 gap-2">
        {plan.weeks.map((w) => (
          <Link
            key={w.weekNumber}
            href={`/plan?week=${w.weekNumber}`}
            aria-current={w.weekNumber === weekNumber ? "page" : undefined}
            className={cn(
              "rounded-md border py-2 text-center text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              w.weekNumber === weekNumber ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            Week {w.weekNumber}
          </Link>
        ))}
      </nav>

      {week.focus && <p className="text-sm text-muted-foreground">{week.focus}</p>}
      <div className="space-y-4">
        {week.days.map((day) => (
          <DayCard key={day.id} day={day} />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Want a fresh plan? Regenerating replaces this one (up to 3 times per day).
          </p>
          <Button asChild variant="outline">
            <Link href="/plan/generating">Regenerate plan</Link>
          </Button>
        </CardContent>
      </Card>
      <DisclaimerFooter />
    </main>
  );
}
