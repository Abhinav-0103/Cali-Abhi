import { expect, test } from "@playwright/test";
import { localAdmin, signInWithMagicLink } from "./helpers";

test("signed-out users are sent to login", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
});

test("magic link signs a new user in and lands on onboarding", async ({ page }) => {
  await signInWithMagicLink(page, `e2e-${Date.now()}@example.test`);
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
});

test("a user can permanently delete their account", async ({ page }) => {
  const email = `delete-${Date.now()}@example.test`;
  await signInWithMagicLink(page, email);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const confirm = page.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect(page.getByText("Your account and all your data have been deleted.")).toBeVisible();

  const admin = await localAdmin();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(false);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});
