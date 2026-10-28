"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudOff, CloudUpload, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  abandonWorkout,
  finishWorkout,
  logSet,
  removeLastSet,
  setRpe,
  setSkipped,
  setsFor,
  unloggedSets,
} from "@/lib/workout/logic";
import type { MobilityItem } from "@/lib/workout/types";
import { ExerciseCard } from "./exercise-card";
import { formatClock, primeAudio, RestTimer } from "./rest-timer";
import { useWorkout } from "./use-workout";

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export function WorkoutLogger({ sessionId, userId }: { sessionId: string; userId: string }) {
  const router = useRouter();
  const { state, workout, update, online, pending, syncNow } = useWorkout(sessionId, userId);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setElapsedNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep the screen on while training (where supported).
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        // Not supported or not allowed: fine.
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  const endRest = useCallback(() => setRestEndsAt(null), []);

  if (state.kind === "loading") {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (state.kind === "missing" || !workout) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p role="alert">We couldn&rsquo;t find this workout{online ? "" : " on this device, and you're offline"}.</p>
          <Button asChild variant="outline">
            <Link href="/today">Back to Today</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const finished = workout.session.status !== "in_progress";
  const remaining = unloggedSets(workout);

  async function finish(abandon = false) {
    update((w) => (abandon ? abandonWorkout(w, nowIso()) : finishWorkout(w, nowIso())));
    setRestEndsAt(null);
    // Give IndexedDB a moment, then try to sync; it retries later if offline.
    setTimeout(() => void syncNow(), 50);
    router.push(abandon ? "/today" : `/workout/${sessionId}/summary`);
  }

  return (
    <div className="space-y-4 pb-28">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <Link
            href="/today"
            className="flex items-center gap-1 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden /> Today
          </Link>
          <SyncBadge online={online} pending={pending} />
        </div>
        <h1 className="text-2xl font-bold">{workout.title}</h1>
        <p className="text-sm text-muted-foreground">
          {workout.session.week_number && `Week ${workout.session.week_number} · Day ${workout.session.day_number} · `}
          <span className="tabular-nums">{formatClock((elapsedNow - Date.parse(workout.session.started_at)) / 1000)}</span>{" "}
          elapsed
        </p>
      </header>

      <MobilityList title="Warm-up" items={workout.warmup} />

      {workout.exercises.map((e) => (
        <ExerciseCard
          key={e.id}
          exercise={e}
          sets={setsFor(workout, e.id)}
          onLog={(setNumber, value) => {
            primeAudio();
            update((w) => logSet(w, e.id, setNumber, value, { now: nowIso(), newId }));
            if (e.rest_seconds > 0) setRestEndsAt(Date.now() + e.rest_seconds * 1000);
          }}
          onRemoveLast={() => update((w) => removeLastSet(w, e.id))}
          onRpe={(rpe) => update((w) => setRpe(w, e.id, rpe))}
          onSkip={(skipped) => update((w) => setSkipped(w, e.id, skipped))}
        />
      ))}

      <MobilityList title="Cool-down" items={workout.cooldown} />

      {!finished && (
        <Card>
          <CardContent className="space-y-3">
            {confirmFinish && remaining > 0 ? (
              <>
                <p role="alert" className="text-sm">
                  You still have {remaining} planned {remaining === 1 ? "set" : "sets"} to log. Finish anyway?
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => finish()}>Finish workout</Button>
                  <Button variant="outline" onClick={() => setConfirmFinish(false)}>
                    Keep going
                  </Button>
                </div>
              </>
            ) : (
              <Button size="lg" className="w-full" onClick={() => (remaining > 0 ? setConfirmFinish(true) : finish())}>
                Finish workout
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                if (window.confirm("Discard this workout? It won't count towards your plan.")) void finish(true);
              }}
            >
              Discard workout
            </Button>
          </CardContent>
        </Card>
      )}

      {restEndsAt && (
        <RestTimer endsAt={restEndsAt} onAdjust={(d) => setRestEndsAt((t) => (t ? t + d : t))} onDone={endRest} />
      )}
    </div>
  );
}

function SyncBadge({ online, pending }: { online: boolean; pending: boolean }) {
  const [Icon, text] = !online
    ? [CloudOff, "Offline · saved on this device"]
    : pending
      ? [CloudUpload, "Saving…"]
      : [Cloud, "Synced"];
  return (
    <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden /> {text}
    </span>
  );
}

function MobilityList({ title, items }: { title: string; items: MobilityItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardContent>
        <details>
          <summary className="cursor-pointer rounded font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {title} <span className="text-sm font-normal text-muted-foreground">· {items.length} drills</span>
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.name} className="flex justify-between">
                <span>{item.name}</span>
                <span className="text-muted-foreground">{item.target}</span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
