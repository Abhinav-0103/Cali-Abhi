import { expect, test } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink } from "./helpers";

test("plan overview, week navigation, regeneration and the daily limit", async ({ page }) => {
  await signInWithMagicLink(page, `plan-${Date.now()}@example.test`);
  await completeOnboarding(page);

  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Day 1 · Mon")).toBeVisible();
  await expect(page.getByText(/Warm-up:/).first()).toBeVisible();

  // Switch weeks
  await page.getByRole("link", { name: "Week 4" }).click();
  await expect(page.getByRole("link", { name: "Week 4" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/Deload/)).toBeVisible();

  // Generations 2 and 3 of the day succeed…
  for (let i = 0; i < 2; i++) {
    await page.getByRole("link", { name: "Regenerate plan" }).click();
    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });
  }
  // …the 4th is refused
  await page.getByRole("link", { name: "Regenerate plan" }).click();
  await expect(page.getByText(/up to 3 plans per day/)).toBeVisible();
  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page.getByRole("heading", { name: "Next workout" })).toBeVisible();
});
