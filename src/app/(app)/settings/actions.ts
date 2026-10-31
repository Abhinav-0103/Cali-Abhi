"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateUnits(raw: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(["metric", "imperial"]).safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ unit_system: parsed.data }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

/**
 * Permanently deletes the signed-in user. Every table cascades from auth.users
 * (ai_usage keeps anonymised cost rows with user_id set to null).
 */
export async function deleteAccount(confirmation: unknown): Promise<{ ok: boolean; message?: string }> {
  if (confirmation !== "DELETE") return { ok: false, message: "Type DELETE to confirm." };
  const { supabase, user } = await requireUser();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account deletion failed", error.message);
    return { ok: false, message: "Couldn't delete your account. Please try again." };
  }
  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
}
