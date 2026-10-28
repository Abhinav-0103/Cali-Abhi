import "server-only";
import type { BodyPart, Equipment, Experience, Goal, Sex, SkillGoal } from "@/lib/constants";
import { aiMockEnabled, serverEnv } from "@/lib/env";
import { callClaude } from "@/lib/ai/anthropic";
import { buildPlanUserMessage, PLAN_SYSTEM_PROMPT, type TrainingProfile } from "@/lib/ai/plan-prompt";
import { filterExercises, startingPoints } from "@/lib/exercises/filter";
import type { Exercise } from "@/lib/exercises/library";
import { dateInTimeZone } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { generatePlan, type ChatMessage, type ModelResult } from "./generate";
import { planOutputSchema } from "./schema";
import { templatePlan, type TemplateInput } from "./template";

/**
 * Generates and stores the first version of a plan. Runs after the HTTP
 * response (Next.js after()); never throws — failures mark the plan failed.
 */
export async function runPlanGeneration(userId: string, planId: string) {
  const admin = createAdminClient();
  try {
    const [profileRes, baselineRes, weightRes, exercisesRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).single(),
      admin.from("baseline_tests").select("*").eq("user_id", userId).order("tested_on", { ascending: false }).limit(1).single(),
      admin.from("body_weight_logs").select("weight_kg").eq("user_id", userId).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
      admin.from("exercises").select("*"),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (baselineRes.error) throw baselineRes.error;
    if (exercisesRes.error) throw exercisesRes.error;

    const p = profileRes.data;
    const b = baselineRes.data;
    const today = dateInTimeZone(p.timezone);

    // Whitelisted training data only — nothing identifying goes to the model.
    const profile: TrainingProfile = {
      age: Number(today.slice(0, 4)) - (p.birth_year ?? 0),
      sex: p.sex as Sex,
      heightCm: Number(p.height_cm),
      weightKg: weightRes.data ? Number(weightRes.data.weight_kg) : null,
      goal: p.goal as Goal,
      skillGoals: p.skill_goals as SkillGoal[],
      experience: p.experience as Experience,
      baseline: {
        pushUps: b.push_ups,
        pullUps: b.pull_ups,
        squats: b.squats,
        plankSeconds: b.plank_seconds,
        deadHangSeconds: b.dead_hang_seconds,
      },
      equipment: p.equipment as Equipment[],
      daysPerWeek: p.days_per_week!,
      minutesPerSession: p.minutes_per_session!,
      preferredDays: p.preferred_days,
      injuryAreas: p.injury_areas as BodyPart[],
      injuryNotes: p.injury_notes ?? "",
      conservative: p.parq_flagged ?? false,
    };

    const eligible = filterExercises(exercisesRes.data as Exercise[], {
      equipment: profile.equipment,
      injuryAreas: profile.injuryAreas,
      experience: profile.experience,
      conservative: profile.conservative,
    });
    const starts = startingPoints(eligible, profile.baseline);
    const templateInput: TemplateInput = { ...profile, eligible, starts };
    const ctx = {
      eligibleById: new Map(eligible.map((e) => [e.id, e])),
      daysPerWeek: profile.daysPerWeek,
      preferredDays: profile.preferredDays,
      minutesPerSession: profile.minutesPerSession,
    };

    const env = serverEnv();
    const callModel = aiMockEnabled()
      ? async (): Promise<ModelResult> => ({ text: JSON.stringify({ ...templatePlan(templateInput), summary: `[Test AI] ${templatePlan(templateInput).summary}` }) })
      : (messages: ChatMessage[]) =>
          callClaude(
            messages,
            {
              kind: "plan",
              userId,
              model: env.ANTHROPIC_PLAN_MODEL,
              system: PLAN_SYSTEM_PROMPT,
              schema: planOutputSchema,
              maxTokens: 32_000,
              effort: "medium",
            },
            messages.filter((m) => m.role === "user").length,
          );

    const plan = await generatePlan(buildPlanUserMessage(profile, eligible, starts), ctx, {
      callModel,
      template: () => templatePlan(templateInput),
    });

    const saved = await admin.rpc("save_plan_version", {
      p_user_id: userId,
      p_plan_id: planId,
      p_reason: "initial",
      p_summary: plan.summary,
      p_weeks: plan.weeks as unknown as Json,
      p_start_date: today,
    });
    if (saved.error) throw saved.error;
    await admin.from("plans").update({ source: plan.source }).eq("id", planId);
  } catch (error) {
    console.error("plan generation failed", error);
    await admin
      .from("plans")
      .update({ status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" })
      .eq("id", planId)
      .eq("status", "generating");
  }
}
