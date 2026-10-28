// Shared enumerations. Must stay in sync with the CHECK constraints in
// supabase/migrations/*_init.sql.

export const GOALS = ["build_muscle", "lose_fat", "first_pull_up", "skills", "general_fitness"] as const;
export type Goal = (typeof GOALS)[number];

export const SKILL_GOALS = ["handstand", "muscle_up", "l_sit", "front_lever"] as const;
export type SkillGoal = (typeof SKILL_GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const EQUIPMENT = ["pull_up_bar", "dip_bars", "rings", "bands"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const BODY_PARTS = ["neck", "shoulder", "elbow", "wrist", "lower_back", "hip", "knee", "ankle"] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const SEXES = ["male", "female", "other", "prefer_not_to_say"] as const;
export type Sex = (typeof SEXES)[number];

export const EXERCISE_CATEGORIES = ["push", "pull", "dips", "legs", "core", "skill", "mobility"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const METRICS = ["reps", "seconds"] as const;
export type Metric = (typeof METRICS)[number];

export const BLOCKS = ["warmup", "main", "cooldown"] as const;
export type Block = (typeof BLOCKS)[number];

/** 0 = Monday … 6 = Sunday */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
