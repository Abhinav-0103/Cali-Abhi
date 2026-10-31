import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink } from "./helpers";

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${name}: ${v.id} (${v.impact}) — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

test("main screens have no WCAG 2.1 AA violations in light and dark mode", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await audit(page, "landing");
  await page.goto("/login");
  await audit(page, "login");

  await signInWithMagicLink(page, `a11y-${Date.now()}@example.test`);
  await audit(page, "onboarding step 1");
  await page.getByRole("button", { name: "Continue" }).click();
  await audit(page, "onboarding with errors");
  await page.reload();
  await completeOnboarding(page);
  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 30_000 });

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ["/plan", "/today", "/progress", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page, `${path} (${scheme})`);
    }
    await page.goto("/today");
    await page.getByRole("button", { name: "Start workout" }).or(page.getByRole("link", { name: "Resume workout" })).click();
    await expect(page).toHaveURL(/\/workout\//);
    await page.getByRole("button", { name: "Log", exact: true }).first().click();
    await audit(page, `workout with rest timer (${scheme})`);
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
});
