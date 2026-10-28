"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { loadHistory, type HistoryItem } from "@/app/(app)/progress/actions";
import { shortDate } from "@/lib/dates";

export function HistoryList({ initial, initialHasMore }: { initial: HistoryItem[]; initialHasMore: boolean }) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Finished workouts will appear here.</p>;

  return (
    <div className="space-y-3">
      <ul className="divide-y text-sm">
        {items.map((w) => (
          <li key={w.id} className="flex items-center justify-between py-2">
            <span>
              <span className="font-medium">{w.title}</span>
              <span className="block text-xs text-muted-foreground">{shortDate(w.performedOn)}</span>
            </span>
            <span className="text-right text-muted-foreground">
              {w.sets} sets{w.minutes !== null && ` · ${w.minutes} min`}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const last = items.at(-1)!;
              const page = await loadHistory({ date: last.performedOn, id: last.id });
              setItems((prev) => [...prev, ...page.items]);
              setHasMore(page.hasMore);
            })
          }
        >
          {pending ? "Loading…" : "Load older workouts"}
        </Button>
      )}
    </div>
  );
}
