"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/app/(app)/settings/actions";
import { clearOfflineData } from "@/lib/offline/db";
import { clearOfflinePages } from "@/components/pwa/pwa-register";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-destructive/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await deleteAccount(confirmation);
          if (!result.ok) {
            setError(result.message ?? "Something went wrong.");
            return;
          }
          await clearOfflineData().catch(() => {});
          await clearOfflinePages();
          window.location.replace("/?deleted=1");
        });
      }}
    >
      <p className="text-sm">
        This permanently deletes your profile, plans, workouts and progress. It can&rsquo;t be undone.
      </p>
      <div className="space-y-2">
        <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
        <Input
          id="delete-confirm"
          autoComplete="off"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "delete-error" : undefined}
        />
        {error && (
          <p id="delete-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending || confirmation !== "DELETE"}>
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
