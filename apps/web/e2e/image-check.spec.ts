import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// P11 image checks: upload a creative, see bbox overlays synced with findings, fix and re-upload.
// Needs web + worker against the seeded local DB with logo files uploaded
// (`make db-reset && make seed-assets-local && make dev-local`): E2E_WORKER=1.
const CREATIVES = path.resolve(__dirname, "../../../fixtures/paywise/creatives");
const ALT =
  "PayWise Diwali SIP poster: start a SIP from Rs 500 a month and register now for our free Diwali webinar.";
const TITLE = `Diwali poster ${Date.now()}`;

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

async function submitImage(page: Page, file: string, label: RegExp) {
  await page.getByLabel(label).setInputFiles(path.join(CREATIVES, file));
  await page.getByLabel("Alt text").fill(ALT);
  await page.getByRole("button", { name: /Submit for check|Resubmit for check/ }).click();
}

test.describe.configure({ mode: "serial" });
const RUN = process.env.E2E_WORKER === "1" || !!process.env.E2E_BASE_URL;

test("cramped logo is flagged with a VS-03 overlay; the corrected upload clears it", async ({
  page,
}) => {
  test.skip(!RUN, "set E2E_WORKER=1 (local) or E2E_BASE_URL (deployed)");
  test.setTimeout(180_000);
  await signInAs(page, "Creator");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByRole("button", { name: "New draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await submitImage(page, "03-logo-cramped.png", /Or upload a file/);

  await expect(card(page, "VS-03")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: /Image · version 1/ })).toBeVisible();
  await expect(card(page, "VS-03")).toContainText("Logo clear space");

  // The overlay box for the finding is a labelled button; activating it highlights the card.
  const overlay = page.getByRole("button", { name: /^Finding \d+, warning, VS-03/ });
  await expect(overlay).toBeVisible();
  await overlay.click();
  await expect(card(page, "VS-03")).toHaveClass(/border-ring/);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);

  // Fix it in the design, then upload the corrected file.
  const vs03 = card(page, "VS-03");
  await vs03.getByRole("button", { name: /VS-03/ }).click(); // expand (warnings start collapsed)
  await vs03.getByRole("button", { name: "Mark fixed in the image" }).click();
  await expect(vs03).toContainText("Edited fix applied");

  await submitImage(page, "08-good-alt.png", /Upload the corrected image/);
  await expect(page.getByRole("heading", { name: /Image · version 2/ })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Checking against your brand vault…")).toHaveCount(0, {
    timeout: 90_000,
  });
  await expect(card(page, "VS-03")).toHaveCount(0);
  await expect(card(page, "WCAG 1.1.1")).toHaveCount(0);
});
