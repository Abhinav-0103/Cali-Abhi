"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type State = { kind: "waiting" } | { kind: "done"; changes: string[] } | { kind: "error" };

/** Asks the server to run the progression engine for this (synced) workout and shows the result. */
export function PlanUpdates({ sessionId, ready }: { sessionId: string; ready: boolean }) {
  const [state, setState] = useState<State>({ kind: "waiting" });
  const requested = useRef(false);

  useEffect(() => {
    if (!ready || requested.current) return;
    requested.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { changes: string[] };
        setState({ kind: "done", changes: body.changes });
      } catch {
        setState({ kind: "error" });
      }
    })();
  }, [ready, sessionId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden /> Your plan
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm" aria-live="polite">
        {state.kind === "waiting" && (
          <p className="text-muted-foreground">
            {ready ? "Checking your progress…" : "Plan updates will appear once your workout has synced."}
          </p>
        )}
        {state.kind === "error" && <p className="text-muted-foreground">We&rsquo;ll update your plan next time you open the app.</p>}
        {state.kind === "done" &&
          (state.changes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {state.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No changes yet. Hit the top of your target range twice at RPE 8 or below and we&rsquo;ll move you up.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
