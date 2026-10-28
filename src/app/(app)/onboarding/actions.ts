"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { onboardingSchema, parqFlagged, type FieldErrors, type OnboardingField } from "@/lib/schemas/onboarding";

export type OnboardingResult = { ok: false; message: string; fieldErrors?: FieldErrors };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function completeOnboarding(raw: unknown): Promise<OnboardingResult> {
  const { supabase, user } = await requireUser();

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as OnboardingField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, message: "Some answers need fixing.", fieldErrors };
  }
  const input = parsed.data;

  // The client sends its local date; reject clocks that are clearly wrong.
  if (Math.abs(Date.parse(input.today) - Date.now()) > 2 * DAY_MS) {
    return { ok: false, message: "Your device's date looks wrong. Please check it and try again." };
  }

  const flagged = parqFlagged(input.parq);

  // Profile is written last: if anything fails, onboarding stays incomplete and
  // the user can simply submit again (the other writes are idempotent).
  const weight = await supabase
    .from("body_weight_logs")
    .upsert(
      { user_id: user.id, logged_on: input.today, weight_kg: input.weightKg },
      { onConflict: "user_id,logged_on" },
    );
  if (weight.error) return saveFailed(weight.error);

  const cleared = await supabase.from("baseline_tests").delete().eq("user_id", user.id).eq("source", "onboarding");
  if (cleared.error) return saveFailed(cleared.error);

  const baseline = await supabase.from("baseline_tests").insert({
    user_id: user.id,
    tested_on: input.today,
    push_ups: input.pushUps,
    pull_ups: input.pullUps,
    squats: input.squats,
    plank_seconds: input.plankSeconds,
    dead_hang_seconds: input.deadHangSeconds,
    source: "onboarding",
  });
  if (baseline.error) return saveFailed(baseline.error);

  const profile = await supabase
    .from("profiles")
    .update({
      unit_system: input.unitSystem,
      birth_year: Number(input.today.slice(0, 4)) - input.age,
      sex: input.sex,
      height_cm: input.heightCm,
      goal: input.goal,
      skill_goals: input.skillGoals,
      experience: input.experience,
      equipment: input.equipment,
      days_per_week: input.daysPerWeek,
      minutes_per_session: input.minutesPerSession,
      preferred_days: input.preferredDays,
      injury_areas: input.injuryAreas,
      injury_notes: input.injuryNotes || null,
      parq_answers: input.parq,
      parq_acknowledged_at: flagged ? new Date().toISOString() : null,
      timezone: input.timezone,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profile.error) return saveFailed(profile.error);

  redirect("/plan/generating");
}

function saveFailed(error: { message: string }): OnboardingResult {
  console.error("onboarding save failed", error.message);
  return { ok: false, message: "We couldn't save your answers. Please check your connection and try again." };
}
