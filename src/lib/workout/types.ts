import type { Metric } from "@/lib/constants";

// A workout as kept on the device (IndexedDB). It is the source of truth while
// training; sync pushes it to Supabase with idempotent upserts (all ids are
// generated on the device).

export type LocalSession = {
  id: string;
  user_id: string;
  plan_id: string | null;
  plan_day_id: string | null;
  week_number: number | null;
  day_number: number | null;
  status: "in_progress" | "completed" | "abandoned";
  performed_on: string; // user's local date
  started_at: string;
  completed_at: string | null;
};

export type LocalExercise = {
  id: string;
  exercise_id: string;
  plan_exercise_id: string | null;
  position: number;
  planned_sets: number;
  target_min: number;
  target_max: number;
  rpe: number | null;
  skipped: boolean;
  // display-only (not stored in session_exercises)
  name: string;
  metric: Metric;
  unilateral: boolean;
  cues: string[];
  rest_seconds: number;
  notes: string | null;
};

export type LocalSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  value: number;
  logged_at: string;
};

export type MobilityItem = { name: string; target: string };

export type LocalWorkout = {
  session: LocalSession;
  title: string;
  warmup: MobilityItem[];
  cooldown: MobilityItem[];
  exercises: LocalExercise[];
  sets: LocalSet[];
  /** Sets removed on this device that still need deleting on the server. */
  deletedSetIds: string[];
  /** Incremented on every local change; sync records the rev it pushed. */
  rev: number;
  syncedRev: number;
};

/** A plan day as needed to start a workout from it. */
export type StartableDay = {
  planId: string;
  planDayId: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  exercises: {
    id: string;
    block: "warmup" | "main" | "cooldown";
    exerciseId: string;
    name: string;
    metric: Metric;
    unilateral: boolean;
    cues: string[];
    sets: number;
    targetMin: number;
    targetMax: number;
    restSeconds: number;
    notes: string | null;
  }[];
};
