import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink } from "./helpers";

/** Logs every planned set at the pre-filled target (top of range), RPE 7 everywhere, then finishes. */
async function completeWorkoutAtTop(page: Page) {
  await page.goto("/today");
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page).toHaveURL(/\/workout\//);
  const log = page.getByRole("button", { name: "Log", exact: true });
  while (await log.count()) {
    await log.first().click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
  for (const rpe of await page.getByRole("radio", { name: /^RPE 7/ }).all()) await rpe.click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
}

test("two strong sessions level the plan up automatically", async ({ page }) => {
  test.setTimeout(180_000);
  await signInWithMagicLink(page, `progress-${Date.now()}@example.test`);
  await completeOnboarding(page);
  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });

  // Day 1 (Full body A): first data point, nothing changes yet
  await completeWorkoutAtTop(page);
  await expect(page.getByText(/No changes yet/)).toBeVisible({ timeout: 15_000 });

  // Day 2 (Full body B)
  await completeWorkoutAtTop(page);
  await expect(page.getByText(/No changes yet/)).toBeVisible({ timeout: 15_000 });

  // Day 3 (Full body A again): second session at the top → level up
  await completeWorkoutAtTop(page);
  await expect(page.getByText("Diamond push-up → Decline push-up (level up!)")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Tuck hollow hold: targets up by 5 s")).toBeVisible();

  // Today lists the updates; the plan shows the new exercise from next week, not in completed days
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Recent plan updates" })).toBeVisible();
  await page.goto("/plan?week=2");
  await expect(page.getByText("Decline push-up").first()).toBeVisible();
  await expect(page.getByText(/updated 1×/)).toBeVisible();
  await page.goto("/plan?week=1");
  await expect(page.getByText("Diamond push-up").first()).toBeVisible();
});
