import { devices, expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink } from "./helpers";

async function logNextSet(page: Page) {
  await page.getByRole("button", { name: "Log", exact: true }).first().click();
  // The rest timer covers the bottom of the screen; skip it.
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
}

test("log a workout offline, sync it, and follow it live on a second device", async ({ page, browser }) => {
  const email = `workout-${Date.now()}@example.test`;
  await signInWithMagicLink(page, email);
  await completeOnboarding(page);
  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });

  // Start today's workout
  await page.goto("/today");
  await expect(page.getByText("0/12 sessions done")).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Full body A" })).toBeVisible();

  // Set 1 online
  await logNextSet(page);
  await expect(page.getByRole("status").filter({ hasText: "Synced" })).toBeVisible({ timeout: 10_000 });

  // Set 2 + RPE while offline: saved on the device
  await page.context().setOffline(true);
  await expect(page.getByText("Offline · saved on this device")).toBeVisible();
  await logNextSet(page);
  await page.getByRole("radio", { name: /^RPE 8/ }).first().click();
  await expect(page.getByText(/2 reps left/)).toBeVisible();

  // Back online: syncs automatically
  await page.context().setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Synced" })).toBeVisible({ timeout: 15_000 });

  // A second device sees the workout in progress and resumes it from the server
  const tablet = await browser.newContext({ ...devices["Pixel 7"], baseURL: "http://localhost:3000" });
  const other = await tablet.newPage();
  await signInWithMagicLink(other, email);
  await other.goto("/today");
  await other.getByRole("link", { name: "Resume workout" }).click();
  await expect(other.getByRole("button", { name: "Edit set 1" }).first()).toBeVisible();
  await expect(other.getByRole("button", { name: "Edit set 2" }).first()).toBeVisible();
  await expect(other.getByRole("radio", { name: /^RPE 8/ }).first()).toHaveAttribute("aria-checked", "true");

  // Set 3 logged on the phone shows up live on the second device
  await logNextSet(page);
  await expect(other.getByRole("button", { name: "Edit set 3" }).first()).toBeVisible({ timeout: 15_000 });
  await tablet.close();

  // Finish early (confirmation because sets remain) → summary
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByText(/planned sets to log. Finish anyway\?/)).toBeVisible();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  await expect(page.getByText("Saved to your account.")).toBeVisible({ timeout: 10_000 });

  // Today moves on to the next day of the plan
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByText("1/12 sessions done")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Full body B" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
});
