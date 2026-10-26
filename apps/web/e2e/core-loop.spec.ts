import { expect, test, type Page } from "@playwright/test";

// Core loop (storyboard F02→F05). Runs locally with E2E_WORKER=1 (web + worker + seeded DB), or
// against a deployment with E2E_BASE_URL=https://… (demo mode on, worker up).
const HERO =
  "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh! Register now.";
const TITLE = `Storyboard ${Date.now()}`;

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}
const card = (page: Page, code: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: new RegExp(`\\b${code}\\b`) }) })
    .first();

async function newDraft(page: Page, title: string, body: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "New draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox", { name: "Draft text" }).click();
  await page.keyboard.insertText(body);
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await page.getByRole("button", { name: "Submit for check" }).click();
  return page.url().split("/").pop()!;
}

test.describe.configure({ mode: "serial" });
let contentId = "";
const RUN = process.env.E2E_WORKER === "1" || !!process.env.E2E_BASE_URL;

test("F02–F03: creator fixes two, routes CL-03 and resubmits → lands with Legal", async ({
  page,
}) => {
  test.skip(!RUN, "set E2E_WORKER=1 (local) or E2E_BASE_URL (deployed)");
  test.setTimeout(180_000);
  await signInAs(page, "Creator");
  contentId = await newDraft(page, TITLE, HERO);
  for (const code of ["F-048", "E-19", "CL-03"])
    await expect(card(page, code)).toBeVisible({ timeout: 60_000 });

  for (const code of ["F-048", "E-19"]) {
    const c = card(page, code);
    await c.getByRole("button", { name: "Accept fix" }).click();
    await expect(c).toContainText("Fix accepted");
  }
  await card(page, "CL-03").getByRole("button", { name: "Route to Legal" }).click();
  await expect(card(page, "CL-03")).toContainText("Routed to legal");

  await page.getByRole("button", { name: "Resubmit for check" }).click();
  // Routed claim → straight to specialist review (manager skipped).
  await expect(page.getByText("Specialist review", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
});

test("F04: not in the manager's queue; Legal sees diff and citations and signs off", async ({
  page,
}) => {
  test.skip(!RUN, "set E2E_WORKER=1 (local) or E2E_BASE_URL (deployed)");
  await signInAs(page, "Manager");
  await page.goto("/review");
  await expect(page.getByRole("link", { name: TITLE })).toHaveCount(0);

  await page.getByLabel("Switch demo role").selectOption({ label: "Legal" });
  await page.getByRole("button", { name: "Switch" }).click();
  await page.waitForURL(/\/review$/);
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page.getByText("Routed CL-03 · F-112 claim → Legal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(
    page.locator("ins").filter({ hasText: "7:00 PM IST (online)" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Findings these changes resolved")).toBeVisible();

  await page
    .getByLabel("Reason (required)")
    .fill("Historical figure is dated and the disclaimer will be added in the creative.");
  await page.getByRole("button", { name: "Sign off" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});

test("F05: owner marks publish-ready; audit trail lists every transition", async ({ page }) => {
  test.skip(!RUN, "set E2E_WORKER=1 (local) or E2E_BASE_URL (deployed)");
  await signInAs(page, "Creator");
  await page.goto(`/review/${contentId}`);
  await page.getByRole("button", { name: "Mark publish-ready" }).click();
  await expect(page.getByText("Publish ready").first()).toBeVisible();

  await page.getByLabel("Switch demo role").selectOption({ label: "Manager" });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.getByTestId("role-pill")).toHaveText("Manager");
  await page.goto(`/review/${contentId}`);
  const audit = page.locator("#audit");
  for (const step of [
    "draft → ai_check",
    "ai_check → needs_revision",
    "needs_revision → ai_check",
    "ai_check → specialist_review",
    "specialist_review → approved",
    "approved → publish_ready",
  ]) {
    await expect(audit).toContainText(step);
  }
  await expect(audit).toContainText("Dev (Legal)");
  await expect(audit).toContainText("Historical figure is dated");
});
