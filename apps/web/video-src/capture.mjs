// Captures real Errata screens for the "How it works" demo video (docs/ui-redesign, brag-plan.md).
// Drives the running local app (make dev-local) through the core loop with the demo roles and the
// fictional PayWise data only. Output: video-src/composition/shots/*.png (2x, light theme).
// Usage (from apps/web): node video-src/capture.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "composition", "shots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CREATIVE = join(HERE, "../../../fixtures/paywise/creatives/05-low-contrast.png");
const HERO =
  "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh! Register now.";
const SIGN_OFF = "Historical figure is dated and the disclaimer will be added in the creative.";
mkdirSync(OUT, { recursive: true });

const HIDE = `nextjs-portal, [data-sonner-toaster] { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
  colorScheme: "light",
});
await ctx.addCookies([{ name: "bl_theme", value: "light", url: BASE }]);
const page = await ctx.newPage();
page.setDefaultTimeout(30_000);
const shot = async (name, target = page) => {
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(400);
  await target.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("saved", name);
};
const card = (code) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: new RegExp(`\\b${code}\\b`) }) })
    .first();
async function signInAs(label) {
  await page.goto(`${BASE}/login`);
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}
async function newDraft(title) {
  await page.goto(`${BASE}/drafts/new`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
}
async function intent() {
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
}

// 1. Creator writes the caption and fills the intent.
await signInAs("Creator");
await newDraft("Diwali SIP caption");
await page.getByRole("textbox", { name: "Draft text" }).click();
await page.keyboard.type(HERO);
await intent();
await page.mouse.move(0, 0);
await shot("01-write");

// 2. Submit and wait for the cited findings.
await page.getByRole("button", { name: "Submit for check" }).click();
for (const code of ["CL-03", "E-19", "G-07", "F-048"])
  await card(code).waitFor({ state: "visible", timeout: 90_000 });
// Warnings start collapsed; open G-07 so its explanation and fix show.
await card("G-07")
  .locator('h3 button[aria-expanded="false"]')
  .click()
  .catch(() => {});
await page.waitForTimeout(500);
await shot("02-findings");
// Card crops: let the findings column grow and hide its sticky panels so nothing overlaps a card.
// Layout only; the cards' content is untouched.
const UNSTICK = `section[aria-label="Check run"], .bg-warning-bg[role="status"], .sticky.bottom-0 { display: none !important; }
  .lg\\:max-h-\\[calc\\(100dvh-6rem\\)\\] { max-height: none !important; position: static !important; }
  .min-h-0.flex-1.overflow-y-auto { overflow: visible !important; }`;
const cropCards = async (codes) => {
  await page.setViewportSize({ width: 1440, height: 3000 });
  await page.addStyleTag({ content: UNSTICK });
  for (const code of codes) {
    await card(code)
      .locator('h3 button[aria-expanded="false"]')
      .click()
      .catch(() => {});
    await page.waitForTimeout(300);
    await shot(`card-${code}`, card(code));
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForLoadState("networkidle");
};
await cropCards(["CL-03", "E-19", "G-07", "F-048"]);

// 3. Accept the two fact fixes, route the claim to Legal, resubmit.
for (const code of ["F-048", "E-19"]) {
  await card(code).getByRole("button", { name: "Accept fix" }).click();
  await card(code).getByText("Fix accepted").waitFor();
}
await card("CL-03").getByRole("button", { name: "Route to Legal" }).click();
await card("CL-03").getByText("Routed to legal").waitFor();
await page.waitForTimeout(600);
await shot("03-routed");
await page.getByRole("button", { name: "Resubmit for check" }).click();
await page.getByText("Legal review", { exact: true }).first().waitFor({ timeout: 90_000 });
const contentId = page.url().split("/").pop();

// 4. Legal reviews and signs off with a reason.
await page.getByRole("button", { name: "Switch role" }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /^Legal\b/ })
  .click();
await page.getByTestId("role-pill").getByText("Legal").waitFor();
await page.goto(`${BASE}/review/${contentId}`);
await page.waitForLoadState("networkidle");
await page.getByText("Routed CL-03 · F-112 claim → Legal").waitFor();
await shot("04-legal");
await page.getByRole("button", { name: "Sign off" }).click();
await page.getByRole("dialog").getByLabel("Reason (required)").fill(SIGN_OFF);
await shot("05-signoff");
await page.getByRole("button", { name: "Confirm sign-off" }).click();
await page.getByText("Approved", { exact: true }).first().waitFor({ timeout: 15_000 });
await page.getByRole("tab", { name: "Audit" }).click();
await page.locator("#audit").getByText("specialist_review → approved").waitFor();
await page.waitForTimeout(400);
await shot("06-audit");
await shot("06-audit-list", page.locator("#audit"));

// 5. A low-contrast image: WCAG 1.4.3 with the measured ratio.
await page.getByRole("button", { name: "Switch role" }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: /^Creator\b/ })
  .click();
await page.getByTestId("role-pill").getByText("Creator").waitFor();
await newDraft("Diwali SIP poster");
await intent();
await page.getByLabel(/Or upload a file/).setInputFiles(CREATIVE);
await page
  .getByLabel("Alt text")
  .fill("Diwali SIP poster: start a SIP from Rs 500 a month. Register now.");
await page.getByRole("button", { name: "Submit for check" }).click();
const wcag = card("WCAG 1.4.3");
await wcag.waitFor({ state: "visible", timeout: 120_000 });
await wcag
  .locator('h3 button[aria-expanded="false"]')
  .click()
  .catch(() => {});
await page.waitForTimeout(600);
await shot("07-image");
await cropCards(["WCAG 1.4.3"]);

await browser.close();
console.log("done", contentId);
