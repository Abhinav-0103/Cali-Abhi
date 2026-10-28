"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/redirect";

const emailSchema = z.email("Enter a valid email address");

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError ? "Sign-in failed. Please try again." : "");

  const callbackUrl = () => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", safeNextPath(next));
    return url.toString();
  };

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError("");
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Open it on this
          device to continue.
        </p>
        <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setStatus("idle")}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={sendMagicLink} className="space-y-3" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "login-error" : undefined}
            required
          />
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Email me a magic link"}
        </Button>
      </form>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
        Continue with Google
      </Button>
    </div>
  );
}
