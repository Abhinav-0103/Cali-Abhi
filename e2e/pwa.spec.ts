import { expect, test } from "@playwright/test";
import { completeOnboarding, localAdmin, signInWithMagicLink } from "./helpers";

// Runs against a production build: the service worker is active there.
test("installable app that opens and logs a workout while offline", async ({ page, context, request }) => {
  test.setTimeout(240_000);

  // Manifest is valid for installation
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/today" });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  const headers = (await request.get("/login")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");

  const email = `pwa-${Date.now()}@example.test`;
  await signInWithMagicLink(page, email);
  await completeOnboarding(page);
  // No ANTHROPIC_API_KEY in this build: the AI call fails and the template plan is used.
  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Built from our standard template")).toBeVisible();

  // The failure reason is recorded for cost/ops monitoring
  const admin = await localAdmin();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userId = users.users.find((u) => u.email === email)!.id;
  const { data: usage } = await admin.from("ai_usage").select("outcome, error").eq("user_id", userId);
  expect(usage!.length).toBeGreaterThan(0);
  expect(usage!.every((u) => u.outcome === "api_error" && u.error)).toBe(true);

  // Service worker installs and caches the app for offline use
  await page.goto("/today");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.controller!.postMessage({ type: "warm" }));
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const keys = await caches.keys();
          const pages = keys.find((k) => k.startsWith("pages-"));
          if (!pages) return 0;
          return (await (await caches.open(pages)).keys()).length;
        }),
      { timeout: 30_000 },
    )
    .toBe(6);

  // Cold start while offline
  await context.setOffline(true);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // Start a brand-new workout offline (its URL was never cached)
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Full body A" })).toBeVisible();
  await expect(page.getByText("Offline · saved on this device")).toBeVisible();
  await page.getByRole("button", { name: "Log", exact: true }).first().click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  await expect(page.getByText(/You're offline. Your workout is saved/)).toBeVisible();

  // A page that was never cached shows the offline page
  await page.goto("/plan/generating");
  await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();

  // Back online: the workout syncs and the plan moves on
  await context.setOffline(false);
  await page.goto("/today");
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("1/12 sessions done")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const { data: sessions } = await admin.from("workout_sessions").select("status, set_count:session_exercises(set_logs(count))").eq("user_id", userId);
  expect(sessions).toHaveLength(1);
  expect(sessions![0].status).toBe("completed");

  // Sign-out clears personal pages from the offline cache
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("pages-")).length)).toBe(0);
});
