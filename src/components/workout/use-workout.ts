"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWorkout, putWorkout } from "@/lib/offline/db";
import { fetchWorkout, SYNCED_EVENT, syncDirtyWorkouts, type SyncedDetail } from "@/lib/offline/sync";
import type { LocalWorkout } from "@/lib/workout/types";

type LoadState = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; workout: LocalWorkout };

const SYNC_DEBOUNCE_MS = 500;

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const noopSubscribe = () => () => {};

/**
 * The workout id from the address bar. Offline, the service worker may serve a
 * cached page rendered for a different id, so the URL is the source of truth.
 */
export function useRouteSessionId(fallback: string) {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.pathname.match(/\/workout\/([0-9a-f-]{36})/)?.[1] ?? fallback,
    () => fallback,
  );
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * A workout that lives on the device: every change is saved to IndexedDB
 * immediately and pushed to Supabase in the background. Changes made on
 * another device arrive via Realtime when this device has nothing unsynced.
 */
export function useWorkout(sessionId: string, userId: string) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const workout = state.kind === "ready" ? state.workout : null;
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const online = useOnline();

  const scheduleSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void syncDirtyWorkouts(createClient()), SYNC_DEBOUNCE_MS);
  }, []);

  const refreshFromServer = useCallback(async () => {
    const remote = await fetchWorkout(createClient(), sessionId);
    if (!remote) return null;
    // Only replace local state if it has nothing waiting to be pushed.
    const local = await getWorkout(sessionId);
    if (local && local.rev > local.syncedRev) return local;
    await putWorkout(remote);
    return remote;
  }, [sessionId]);

  // Load: device first, then the server (workout started elsewhere, or newer data).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await getWorkout(sessionId);
      if (local && !cancelled) setState({ kind: "ready", workout: local });
      if (!navigator.onLine) {
        if (!local && !cancelled) setState({ kind: "missing" });
        return;
      }
      try {
        const fresh = await refreshFromServer();
        if (cancelled) return;
        if (fresh) setState({ kind: "ready", workout: fresh });
        else if (!local) setState({ kind: "missing" });
      } catch {
        if (!local && !cancelled) setState({ kind: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshFromServer]);

  /** Applies a change: state, IndexedDB, then background sync. */
  const update = useCallback(
    (change: (w: LocalWorkout) => LocalWorkout) => {
      setState((prev) => {
        if (prev.kind !== "ready") return prev;
        const next = change(prev.workout);
        void putWorkout(next).then(scheduleSync);
        return { kind: "ready", workout: next };
      });
    },
    [scheduleSync],
  );

  // Learn about completed syncs (they run outside this hook).
  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<SyncedDetail>).detail;
      if (detail.sessionId !== sessionId) return;
      setState((prev) =>
        prev.kind === "ready"
          ? {
              kind: "ready",
              workout: {
                ...prev.workout,
                session: { ...prev.workout.session, week_number: detail.session.week_number, day_number: detail.session.day_number },
                syncedRev: Math.max(prev.workout.syncedRev, detail.syncedRev),
                deletedSetIds: prev.workout.deletedSetIds.filter((id) => !detail.clearedDeletes.includes(id)),
              },
            }
          : prev,
      );
    };
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SYNCED_EVENT, onSynced);
  }, [sessionId]);

  // Sync when the connection comes back.
  useEffect(() => {
    if (online) scheduleSync();
  }, [online, scheduleSync]);

  // Live updates from other devices.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const fresh = await refreshFromServer().catch(() => null);
        if (fresh) setState({ kind: "ready", workout: fresh });
      }, 800);
    };
    const channel = supabase
      .channel(`workout-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "set_logs", filter: `user_id=eq.${userId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_exercises", filter: `session_id=eq.${sessionId}` }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workout_sessions", filter: `id=eq.${sessionId}` }, onChange)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, userId, refreshFromServer]);

  const syncNow = useCallback(() => syncDirtyWorkouts(createClient()), []);

  return {
    state,
    workout,
    update,
    online,
    pending: workout ? workout.rev > workout.syncedRev : false,
    syncNow,
  };
}
