import { expect, test, type Page } from "@playwright/test";
import { signInWithMagicLink } from "./helpers";

async function cont(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
}

async function answerHealth(page: Page, yesTo: number[] = []) {
  for (let i = 1; i <= 7; i++) {
    const group = page.getByRole("group", { name: new RegExp(`^${i}\\. `) });
    await group.getByText(yesTo.includes(i) ? "Yes" : "No", { exact: true }).click();
  }
}

test("new user completes onboarding with validation, back navigation and the health warning", async ({ page }) => {
  await signInWithMagicLink(page, `onboard-${Date.now()}@example.test`);
  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1: required fields are enforced and focus moves to the first error
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await cont(page);
  await expect(page.getByText("Enter your age")).toBeVisible();
  await expect(page.getByLabel("Age")).toBeFocused();

  await page.getByText("Imperial (ft, lb)").click();
  await page.getByLabel("Age").fill("29");
  await page.getByText("Female", { exact: true }).click();
  await page.getByLabel("Feet").fill("5");
  await page.getByLabel("Inches").fill("6");
  await page.getByLabel("Body weight").fill("140");
  await cont(page);

  // Step 2: skills goal requires a skill
  await expect(page.getByRole("heading", { name: "Your goal" })).toBeVisible();
  await page.getByText("Skills", { exact: true }).click();
  await cont(page);
  await expect(page.getByText("Pick at least one skill")).toBeVisible();
  await page.getByText("Handstand", { exact: true }).click();
  await cont(page);

  // Step 3, then back to step 2 and forward again keeps answers
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("checkbox", { name: "Handstand" })).toBeChecked();
  await cont(page);
  await page.getByText("Beginner", { exact: true }).click();
  await cont(page);

  // Step 4: baseline (0 pull-ups allowed)
  await expect(page.getByRole("heading", { name: "Baseline test" })).toBeVisible();
  await page.getByLabel("Max push-ups").fill("8");
  await page.getByLabel("Max pull-ups").fill("0");
  await page.getByLabel("Max bodyweight squats").fill("25");
  await page.getByLabel("Plank hold").fill("40");
  await page.getByLabel("Dead hang").fill("15");
  await cont(page);

  // Step 5: equipment
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
  await page.getByText("Pull-up bar", { exact: true }).click();
  await cont(page);

  // Step 6: schedule — preferred days must match days per week
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await page.getByText("Mon", { exact: true }).click();
  await cont(page);
  await expect(page.getByText("Pick exactly 3 days, or none to stay flexible")).toBeVisible();
  await page.getByText("Wed", { exact: true }).click();
  await page.getByText("Fri", { exact: true }).click();
  await cont(page);

  // Step 7: injuries
  await expect(page.getByRole("heading", { name: "Injuries" })).toBeVisible();
  await page.getByText("Wrist", { exact: true }).click();
  await page.getByLabel("Anything else we should know? (optional)").fill("Left wrist sore on push-ups");
  await cont(page);

  // Step 8: a "yes" requires acknowledging the doctor recommendation
  await expect(page.getByRole("heading", { name: "Health check" })).toBeVisible();
  await answerHealth(page, [6]);
  await expect(page.getByText("Please talk to a doctor before you start")).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText("Please confirm you have read the recommendation")).toBeVisible();
  await page.getByLabel(/I understand/).click();
  await page.getByRole("button", { name: "Finish" }).click();

  // Done: lands on Today in conservative mode, and onboarding can't be repeated
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("Conservative mode")).toBeVisible();
  await expect(page.getByText(/Skills · 3 days a week · 45 min/)).toBeVisible();
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/today/);
});

test("onboarding progress survives a page reload", async ({ page }) => {
  await signInWithMagicLink(page, `resume-${Date.now()}@example.test`);
  await page.getByLabel("Age").fill("40");
  await page.getByText("Male", { exact: true }).click();
  await page.getByLabel("Height").fill("180");
  await page.getByLabel("Body weight").fill("82");
  await cont(page);
  await expect(page.getByRole("heading", { name: "Your goal" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your goal" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Age")).toHaveValue("40");
});
