// Pure progress statistics. Dates are calendar dates (YYYY-MM-DD) in the
// user's time zone, as stored in workout_sessions.performed_on.

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string) {
  const ms = toUtc(date);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // 0 = Monday
  return fromUtc(ms - weekday * DAY_MS);
}

export function addDays(date: string, days: number) {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

function countByWeek(dates: string[]) {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(weekStart(d), (counts.get(weekStart(d)) ?? 0) + 1);
  return counts;
}

export type WeekAdherence = { weekStart: string; completed: number; target: number; percent: number };

/** Completed workouts vs. the weekly target for the last `weeks` weeks (oldest first, current week last). */
export function weeklyAdherence(dates: string[], target: number, today: string, weeks = 8): WeekAdherence[] {
  const counts = countByWeek(dates);
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const completed = counts.get(start) ?? 0;
    return { weekStart: start, completed, target, percent: Math.min(100, Math.round((completed / target) * 100)) };
  });
}

/**
 * Consecutive weeks in which the weekly target was met. The current week
 * counts once it's met; until then the streak isn't broken by it.
 */
export function weekStreak(dates: string[], target: number, today: string) {
  const counts = countByWeek(dates);
  let week = weekStart(today);
  if ((counts.get(week) ?? 0) < target) week = addDays(week, -7);
  let streak = 0;
  while ((counts.get(week) ?? 0) >= target) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}
