import AxeBuilder from "@axe-core/playwright";
import { switchDemoRole } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

// Needs the web app running with NEXT_PUBLIC_DEMO_MODE=true against a seeded DB
// (`make db-reset && make dev-web-local`).

const WORKSPACE = ["Settings", "Services & AI use"];
const ROLES = [
  {
    button: "Brand admin",
    pill: "Brand admin",
    nav: [
      "Drafts",
      "Review queue",
      "Rule cards",
      "Facts",
      "Glossary",
      "Campaigns",
      "Assets",
      "Guides",
      "Insights",
      "Audit log",
      ...WORKSPACE,
    ],
  },
  { button: "Creator", pill: "Creator", nav: ["Drafts", ...WORKSPACE] },
  { button: "Agency", pill: "Agency", nav: ["Drafts", ...WORKSPACE] },
  {
    button: "Manager",
    pill: "Manager",
    nav: ["Drafts", "Review queue", "Insights", "Audit log", ...WORKSPACE],
  },
  { button: "Legal", pill: "Legal", nav: ["Review queue", "Audit log", ...WORKSPACE] },
  {
    button: "Accessibility",
    pill: "Accessibility",
    nav: ["Review queue", "Audit log", ...WORKSPACE],
  },
];

async function signInAsDemo(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("signed-out users are redirected to /login", async ({ page }) => {
  await page.goto("/drafts");
  await expect(page).toHaveURL(/\/login\?next=%2Fdrafts$/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
});

test("wrong password shows an accessible error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("creator@paywise.demo");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#login-error")).toHaveAttribute("role", "alert");
  await expect(page.locator("#login-error")).toContainText("Email or password is incorrect");
});

test("email and password sign-in honours ?next", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Email").fill("creator@paywise.demo");
  await page.getByLabel("Password").fill("PayWise-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

for (const role of ROLES) {
  test(`demo role "${role.button}" signs in with one click and sees only its nav`, async ({
    page,
  }) => {
    await signInAsDemo(page, role.button);
    await expect(page.getByTestId("role-pill")).toHaveText(role.pill);
    const nav = page.getByRole("navigation", { name: "Main" }).getByRole("link");
    // Review queue may carry a waiting count after its label.
    await expect(nav).toHaveText(
      role.nav.map((n) => new RegExp(`^${n.replace(/[&]/g, "\\$&")}(\\d+ waiting)?$`)),
    );
  });
}

test("signed-in users at /login are redirected to /drafts", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/drafts$/);
});

test("demo role switcher changes the signed-in user", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await switchDemoRole(page, "Manager");
});

test("sign out returns to /login", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.getByRole("button", { name: /^Workspace/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("non-admins can't open admin pages", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.goto("/vault");
  await expect(page.getByRole("heading", { name: "You don't have access to this." })).toBeVisible();
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  // Toasts and findings fade in (DESIGN §4); audit settled frames.
  test.use({ reducedMotion: "reduce" });
  test("/login has no violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page);
  });

  test("/drafts has no violations", async ({ page }) => {
    await signInAsDemo(page, "Creator");
    await expectNoA11yViolations(page);
  });

  test("/settings/ai-use has no violations", async ({ page }) => {
    await signInAsDemo(page, "Brand admin");
    await page.goto("/settings/ai-use");
    await expectNoA11yViolations(page);
  });
});

test.describe("accessibility in dark mode", () => {
  test.use({ colorScheme: "dark", reducedMotion: "reduce" });

  test("/login has no violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page);
  });

  test("/drafts has no violations", async ({ page }) => {
    await signInAsDemo(page, "Brand admin");
    await expectNoA11yViolations(page);
  });
});
