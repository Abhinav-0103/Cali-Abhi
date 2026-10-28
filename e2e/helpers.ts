import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

async function findMagicLink(email: string): Promise<string | null> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await res.json()) as { messages?: { ID: string }[] };
  if (!messages?.length) return null;
  const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
  return msg.Text.match(/https?:\/\/\S+\/verify\S+/)?.[0] ?? null;
}

/** Signs in through the real magic-link flow, reading the email from local Mailpit. */
export async function signInWithMagicLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a magic link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  let link: string | null = null;
  await expect.poll(async () => (link = await findMagicLink(email)), { timeout: 15_000 }).not.toBeNull();
  await page.goto(link!);
}

/** Fills onboarding with minimal valid answers (no health flags) and finishes it. */
export async function completeOnboarding(page: Page) {
  const cont = () => page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Age").fill("30");
  await page.getByText("Male", { exact: true }).click();
  await page.getByLabel("Height").fill("180");
  await page.getByLabel("Body weight").fill("80");
  await cont();
  await page.getByText("Build muscle", { exact: true }).click();
  await cont();
  await page.getByText("Intermediate", { exact: true }).click();
  await cont();
  for (const [label, value] of [["Max push-ups", "20"], ["Max pull-ups", "5"], ["Max bodyweight squats", "40"], ["Plank hold", "60"], ["Dead hang", "40"]]) {
    await page.getByLabel(label).fill(value);
  }
  await cont();
  await page.getByText("Pull-up bar", { exact: true }).click();
  await cont();
  await cont(); // schedule defaults: 3 days, 45 min, flexible
  await cont(); // no injuries
  for (let i = 1; i <= 7; i++) {
    await page.getByRole("group", { name: new RegExp(`^${i}\\. `) }).getByText("No", { exact: true }).click();
  }
  await page.getByRole("button", { name: "Finish" }).click();
}
