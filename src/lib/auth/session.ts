import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The verified user, or a redirect to /login. Deduplicated per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
});

export const getProfile = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  return { supabase, user, profile };
});

/** For pages that need a finished onboarding. */
export async function requireOnboardedProfile() {
  const ctx = await getProfile();
  if (!ctx.profile.onboarding_completed_at) redirect("/onboarding");
  return ctx;
}
