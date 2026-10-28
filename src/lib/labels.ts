import type { BodyPart, Equipment, Experience, Goal, Sex, SkillGoal } from "@/lib/constants";

export const GOAL_LABELS: Record<Goal, { label: string; description: string }> = {
  build_muscle: { label: "Build muscle", description: "Get stronger and add size with progressive bodyweight training" },
  lose_fat: { label: "Lose fat", description: "Higher-density sessions that burn energy while keeping strength" },
  first_pull_up: { label: "First pull-up", description: "A focused path from dead hangs to your first strict pull-up" },
  skills: { label: "Skills", description: "Handstand, muscle-up, L-sit or front lever" },
  general_fitness: { label: "General fitness", description: "Balanced strength, mobility and conditioning" },
};

export const SKILL_LABELS: Record<SkillGoal, string> = {
  handstand: "Handstand",
  muscle_up: "Muscle-up",
  l_sit: "L-sit",
  front_lever: "Front lever",
};

export const EXPERIENCE_LABELS: Record<Experience, { label: string; description: string }> = {
  beginner: { label: "Beginner", description: "New to training, or back after a long break" },
  intermediate: { label: "Intermediate", description: "Training regularly for 6+ months, can do push-ups and some pull-ups" },
  advanced: { label: "Advanced", description: "Years of consistent training, working on advanced skills" },
};

export const EQUIPMENT_LABELS: Record<Equipment, { label: string; description: string }> = {
  pull_up_bar: { label: "Pull-up bar", description: "Doorway, wall-mounted or a park bar" },
  dip_bars: { label: "Dip bars or parallettes", description: "Parallel bars, dip station or low parallettes" },
  rings: { label: "Gymnastic rings", description: "Hung from a bar, beam or tree" },
  bands: { label: "Resistance bands", description: "Loop bands for assistance or rows" },
};

export const SEX_LABELS: Record<Sex, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  neck: "Neck",
  shoulder: "Shoulder",
  elbow: "Elbow",
  wrist: "Wrist",
  lower_back: "Lower back",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle",
};
