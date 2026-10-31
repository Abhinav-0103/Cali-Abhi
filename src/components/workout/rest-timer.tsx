"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

let audio: AudioContext | undefined;

/** Must be called from a user gesture (e.g. logging a set) so audio can play later. */
export function primeAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    // Audio unsupported: the timer still vibrates and shows on screen.
  }
}

function beep() {
  if (!audio) return;
  for (const [offset, freq] of [[0, 880], [0.25, 880], [0.5, 1175]] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audio.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + offset + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + offset);
    osc.stop(audio.currentTime + offset + 0.2);
  }
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Countdown between sets. Based on an end timestamp, so it stays correct
 * when the phone is locked or the tab is in the background.
 */
export function RestTimer({ endsAt, onAdjust, onDone }: { endsAt: number; onAdjust: (deltaMs: number) => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.ceil((endsAt - now) / 1000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining > 0) return;
    beep();
    navigator.vibrate?.([200, 100, 200]);
    onDone();
  }, [remaining, onDone]);

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Rest</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatClock(remaining)}</p>
        </div>
        {/* Announce only at the end, not every second. */}
        <p className="sr-only" aria-live="assertive">
          {remaining <= 0 ? "Rest over. Start your next set." : ""}
        </p>
        <div className="flex gap-2">
          {/* The accessible name starts with the visible text (voice control users say what they see). */}
          <Button variant="outline" size="sm" onClick={() => onAdjust(-15_000)}>
            −15s<span className="sr-only"> rest</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdjust(15_000)}>
            +15s<span className="sr-only"> rest</span>
          </Button>
          <Button size="sm" onClick={onDone}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
