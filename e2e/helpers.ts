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
