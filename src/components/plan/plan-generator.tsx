"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const MESSAGES = [
  "Reading your baseline test…",
  "Picking exercises that match your equipment…",
  "Steering clear of sore spots…",
  "Balancing weekly volume…",
  "Planning 4 weeks of progression…",
  "Fitting sessions into your schedule…",
  "Double-checking everything…",
];
const POLL_MS = 2000;
const GIVE_UP_MS = 6 * 60 * 1000;

type State = { kind: "working"; planId?: string } | { kind: "failed"; message: string } | { kind: "limited"; message: string };

export function PlanGenerator() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "working" });
  const [messageIndex, setMessageIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  // Start (or join) a generation. Guarded so React dev double-effects don't POST twice.
  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    (async () => {
      try {
        const res = await fetch("/api/plans", { method: "POST" });
        const body = (await res.json()) as { planId?: string; error?: string };
        if (res.status === 202 && body.planId) setState({ kind: "working", planId: body.planId });
        else if (res.status === 429) setState({ kind: "limited", message: body.error ?? "Daily limit reached." });
        else setState({ kind: "failed", message: body.error ?? "Something went wrong." });
      } catch {
        setState({ kind: "failed", message: "You seem to be offline. Check your connection and try again." });
      }
    })();
  }, [attempt]);

  // Poll the plan's status until it's ready.
  const planId = state.kind === "working" ? state.planId : undefined;
  useEffect(() => {
    if (!planId) return;
    const supabase = createClient();
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("plans").select("status").eq("id", planId).single();
      if (data?.status === "active") {
        clearInterval(timer);
        router.replace("/plan?new=1");
        router.refresh();
      } else if (data?.status === "failed" || Date.now() - startedAt > GIVE_UP_MS) {
        clearInterval(timer);
        setState({ kind: "failed", message: "We couldn't create your plan this time." });
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [planId, router]);

  useEffect(() => {
    const timer = setInterval(() => setMessageIndex((i) => (i + 1) % MESSAGES.length), 3000);
    return () => clearInterval(timer);
  }, []);

  if (state.kind !== "working") {
    return (
      <Card>
        <CardContent className="space-y-4">
          <p role="alert" className="font-medium">
            {state.message}
          </p>
          <div className="flex gap-3">
            {state.kind === "failed" && (
              <Button
                onClick={() => {
                  setState({ kind: "working" });
                  setAttempt((a) => a + 1);
                }}
              >
                Try again
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/today">Back to Today</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center" aria-busy>
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Building your plan</h1>
        <p className="text-muted-foreground" aria-live="polite">
          {MESSAGES[messageIndex]}
        </p>
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        This usually takes under a minute. You can leave this screen; we&rsquo;ll keep working.
      </p>
    </div>
  );
}
