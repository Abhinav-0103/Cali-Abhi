import { expect, test } from "@playwright/test";
import { signInWithMagicLink } from "./helpers";

test("signed-out users are sent to login", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
});

test("magic link signs a new user in and lands on onboarding", async ({ page }) => {
  await signInWithMagicLink(page, `e2e-${Date.now()}@example.test`);
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
});
