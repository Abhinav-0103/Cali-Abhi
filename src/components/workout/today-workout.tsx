"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localIsoDate } from "@/lib/dates";
import { allWorkouts, cacheNextDay, putWorkout } from "@/lib/offline/db";
import { syncDirtyWorkouts } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { createWorkout } from "@/lib/workout/logic";
import type { StartableDay } from "@/lib/workout/types";

/** Start (or resume) the next workout. Works offline once Today has loaded. */
export function TodayWorkout({ day, userId, serverInProgressId }: { day: StartableDay; userId: string; serverInProgressId: string | null }) {
  const router = useRouter();
  const [localInProgressId, setLocalInProgressId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void cacheNextDay(day);
    void allWorkouts().then((ws) => {
      const mine = ws
        .filter((w) => w.session.user_id === userId && w.session.status === "in_progress")
        .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at));
      setLocalInProgressId(mine[0]?.session.id ?? null);
    });
  }, [day, userId]);

  const resumeId = localInProgressId ?? serverInProgressId;
  if (resumeId) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={`/workout/${resumeId}`}>
          <RotateCcw aria-hidden /> Resume workout
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={starting}
      onClick={async () => {
        setStarting(true);
        const workout = createWorkout(day, {
          userId,
          today: localIsoDate(),
          now: new Date().toISOString(),
          newId: () => crypto.randomUUID(),
        });
        await putWorkout(workout);
        void syncDirtyWorkouts(createClient());
        router.push(`/workout/${workout.session.id}`);
      }}
    >
      <Play aria-hidden /> {starting ? "Starting…" : "Start workout"}
    </Button>
  );
}
