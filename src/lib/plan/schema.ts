import { z } from "zod";
import { BLOCKS } from "@/lib/constants";

// The JSON plan Claude must return (also used for the template fallback).
// Constraints the structured-output schema can't express (min/max/length) are
// stripped by the SDK for the API and enforced here when we validate.

const range = z.object({ min: z.int().min(1).max(600), max: z.int().min(1).max(600) });

export const planExerciseSchema = z.object({
  block: z.enum(BLOCKS),
  exercise_id: z.string(),
  sets: z.int().min(1).max(10),
  rep_range: range.nullable().describe("Required when the exercise metric is reps, otherwise null"),
  hold_range: range.nullable().describe("Required when the exercise metric is seconds, otherwise null"),
  rest_seconds: z.int().min(0).max(600),
  notes: z.string().max(200).describe("Short coaching note, or empty string"),
});

export const planDaySchema = z.object({
  day_number: z.int().min(1).max(6),
  weekday: z.int().min(0).max(6).describe("0 = Monday … 6 = Sunday"),
  title: z.string().min(1).max(60),
  focus: z.string().max(120),
  exercises: z.array(planExerciseSchema).min(3).max(16),
});

export const planWeekSchema = z.object({
  week_number: z.int().min(1).max(4),
  focus: z.string().max(120),
  days: z.array(planDaySchema).min(2).max(6),
});

export const planOutputSchema = z.object({
  summary: z.string().min(1).max(600).describe("2–4 sentences for the user: why this plan fits them"),
  weeks: z.array(planWeekSchema).length(4),
});

export type PlanOutput = z.infer<typeof planOutputSchema>;
export type PlanExerciseOutput = z.infer<typeof planExerciseSchema>;

/** Normalised shape stored via the save_plan_version RPC. */
export type StoredPlanExercise = {
  block: (typeof BLOCKS)[number];
  exercise_id: string;
  sets: number;
  target_min: number;
  target_max: number;
  rest_seconds: number;
  notes: string | null;
};
export type StoredPlanDay = { day_number: number; weekday: number; title: string; focus: string; exercises: StoredPlanExercise[] };
export type StoredPlanWeek = { week_number: number; focus: string; days: StoredPlanDay[] };
