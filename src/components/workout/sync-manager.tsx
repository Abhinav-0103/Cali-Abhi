"use client";

import { useEffect } from "react";
import { allWorkouts, deleteWorkout } from "@/lib/offline/db";
import { syncDirtyWorkouts } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { warmOfflineCache } from "@/components/pwa/pwa-register";

const INTERVAL_MS = 30_000;
const KEEP_FINISHED_MS = 24 * 60 * 60 * 1000;

/** Pushes unsynced workouts whenever the app is open and online. Mounted once in the app layout. */
export function SyncManager() {
  useEffect(() => {
    const supabase = createClient();
    const run = async () => {
      await syncDirtyWorkouts(supabase);
      void warmOfflineCache();
      // Tidy up finished workouts that are safely on the server.
      for (const w of await allWorkouts()) {
        const finishedAt = w.session.completed_at ? Date.parse(w.session.completed_at) : null;
        if (finishedAt && w.rev <= w.syncedRev && Date.now() - finishedAt > KEEP_FINISHED_MS) {
          await deleteWorkout(w.session.id);
        }
      }
    };
    void run();
    const onVisible = () => document.visibilityState === "visible" && void run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(run, INTERVAL_MS);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);
  return null;
}
