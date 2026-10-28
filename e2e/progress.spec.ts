import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { completeOnboarding, localAdmin, signInWithMagicLink } from "./helpers";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Monday of this week (UTC, matching the test browser's time zone) plus offsets. */
function day(weeksAgo: number, weekday: number) {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  return isoDate(new Date(monday.getTime() + (weekday - weeksAgo * 7) * 86_400_000));
}

test("progress: streak, adherence, baselines, weight, personal bests and paginated history", async ({ page }) => {
  const email = `stats-${Date.now()}@example.test`;
  await signInWithMagicLink(page, email);
  await completeOnboarding(page);
  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });

  // Seed 12 completed workouts: 3 in each of the last 3 weeks, 2 this week (if the week has
  // started far enough), 1 five weeks ago. Each logs push-ups.
  const admin = await localAdmin();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userId = users.users.find((u) => u.email === email)!.id;
  const dates = [
    ...[1, 2, 3].flatMap((w) => [day(w, 0), day(w, 2), day(w, 4)]),
    day(0, 0),
    day(0, 0),
    day(5, 1),
  ].filter((d) => d <= isoDate(new Date()));
  for (const [i, performed_on] of dates.entries()) {
    const sessionId = randomUUID();
    const seId = randomUUID();
    const started = `${performed_on}T10:00:00Z`;
    await admin.from("workout_sessions").insert({
      id: sessionId, user_id: userId, status: "completed", performed_on, started_at: started,
      completed_at: `${performed_on}T10:30:00Z`, progression_applied_at: started,
    });
    await admin.from("session_exercises").insert({
      id: seId, session_id: sessionId, user_id: userId, exercise_id: "push_up", position: 1, planned_sets: 3, target_min: 8, target_max: 12,
    });
    await admin.from("set_logs").insert(
      [1, 2, 3].map((n) => ({ id: randomUUID(), session_exercise_id: seId, user_id: userId, set_number: n, value: 10 + i, logged_at: started })),
    );
  }

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toBeVisible();

  // Streak: the last 3 weeks met the target of 3; this week (2 so far) doesn't break it
  await expect(page.getByText("weeks in a row with 3+ workouts")).toBeVisible();
  await expect(page.locator("text=Week streak").locator("..").getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText(`${dates.length}`, { exact: true }).first()).toBeVisible();

  // Adherence chart with a table view
  await expect(page.getByRole("img", { name: /Weekly adherence for the last 8 weeks/ })).toBeVisible();

  // Personal best = the highest seeded value
  const best = 10 + dates.length - 1;
  await expect(page.getByText(`${best} reps`)).toBeVisible();

  // Body weight: log a second entry → a trend chart appears
  await page.getByLabel("Weight (kg)").fill("79.4");
  await page.getByLabel("Date", { exact: true }).fill(day(1, 0));
  await page.getByRole("button", { name: "Log weight" }).click();
  await expect(page.getByRole("img", { name: /Body weight over time/ })).toBeVisible();
  // Invalid input is rejected with an accessible error
  await page.getByLabel("Weight (kg)").fill("5");
  await page.getByRole("button", { name: "Log weight" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Weight looks too low" })).toBeVisible();

  // Retest → baseline chart appears; switch metric
  await page.getByRole("button", { name: "Log a retest" }).click();
  for (const [label, value] of [["Push-ups", "25"], ["Pull-ups", "7"], ["Squats", "45"], ["Plank", "75"], ["Dead hang", "50"]]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Save retest" }).click();
  await expect(page.getByRole("img", { name: /Max push-ups over time/ })).toBeVisible();
  await page.getByText("Pull-ups", { exact: true }).click();
  await expect(page.getByRole("img", { name: /Max pull-ups over time:.*7 reps/ })).toBeVisible();

  // History: 10 per page, then the rest
  const history = page.getByRole("heading", { name: "Workout history" }).locator("../..");
  await expect(history.getByRole("listitem")).toHaveCount(10);
  await history.getByRole("button", { name: "Load older workouts" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(dates.length);
  await expect(history.getByRole("button", { name: "Load older workouts" })).toHaveCount(0);
});
