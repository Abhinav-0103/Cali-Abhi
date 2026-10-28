"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { allWorkouts, clearOfflineData } from "@/lib/offline/db";
import { syncDirtyWorkouts } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";

/** Syncs, then clears on-device workout data before signing out (shared devices). */
export function SignOutButton({ variant = "outline" }: { variant?: "outline" | "link" }) {
  const formRef = useRef<HTMLFormElement>(null);

  async function signOut() {
    try {
      await syncDirtyWorkouts(createClient());
      const unsynced = (await allWorkouts()).filter((w) => w.rev > w.syncedRev);
      if (unsynced.length > 0 && !window.confirm("A workout hasn't synced yet and will be lost if you sign out. Sign out anyway?")) {
        return;
      }
      await clearOfflineData();
    } catch {
      // Storage unavailable: nothing to clear.
    }
    formRef.current?.submit();
  }

  return (
    <form ref={formRef} action="/auth/signout" method="post">
      <Button
        type="button"
        variant={variant}
        className={variant === "link" ? "h-auto p-0 text-muted-foreground" : undefined}
        onClick={signOut}
      >
        Sign out
      </Button>
    </form>
  );
}
