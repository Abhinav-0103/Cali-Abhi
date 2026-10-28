"use client";

import Link from "next/link";
import { Check, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { summarise } from "@/lib/workout/logic";
import { PlanUpdates } from "./plan-updates";
import { useWorkout } from "./use-workout";

export function WorkoutSummary({ sessionId, userId }: { sessionId: string; userId: string }) {
  const { state, workout, online, pending } = useWorkout(sessionId, userId);

  if (state.kind === "loading") return <Skeleton className="h-64 w-full" />;
  if (!workout) {
    return (
      <p role="alert">
        Workout not found. <Link href="/today" className="text-primary underline">Back to Today</Link>
      </p>
    );
  }

  const s = summarise(workout);
  const stats = [
    { label: "Minutes", value: s.durationMinutes },
    { label: "Sets", value: `${s.setsLogged}/${s.setsPlanned}` },
    ...(s.totalReps > 0 ? [{ label: "Reps", value: s.totalReps }] : []),
    ...(s.totalHoldSeconds > 0 ? [{ label: "Seconds held", value: s.totalHoldSeconds }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <Trophy className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">Workout complete</h1>
        <p className="text-muted-foreground">{workout.title}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border p-3 text-center">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Exercises</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {s.exercises.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2">
                  {e.hitTarget && <Check className="size-4 text-success" aria-label="Target hit" />}
                  {e.name}
                </span>
                <span className="text-right text-muted-foreground">
                  {e.skipped
                    ? "Skipped"
                    : e.values.length
                      ? `${e.values.join(" · ")} ${e.metric === "reps" ? "reps" : "s"}`
                      : "Not logged"}
                  {e.rpe && <span className="block text-xs">RPE {e.rpe}</span>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {workout.session.status === "completed" && <PlanUpdates sessionId={sessionId} ready={online && !pending} />}

      <p role="status" className="text-center text-sm text-muted-foreground">
        {!online ? "You're offline. Your workout is saved and will sync when you reconnect." : pending ? "Saving…" : "Saved to your account."}
      </p>
      <Button asChild size="lg" className="w-full">
        <Link href="/today">Done</Link>
      </Button>
    </div>
  );
}
