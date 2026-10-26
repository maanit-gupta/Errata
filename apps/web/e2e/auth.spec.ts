import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Needs the web app running with NEXT_PUBLIC_DEMO_MODE=true against a seeded DB
// (`make db-reset && make dev-web-local`).

const ROLES = [
  {
    button: "Brand admin",
    pill: "Brand admin",
    nav: ["Drafts", "Review queue", "Vault", "Insights", "Settings"],
  },
  { button: "Creator", pill: "Creator", nav: ["Drafts", "Settings"] },
  { button: "Agency", pill: "Agency", nav: ["Drafts", "Settings"] },
  { button: "Manager", pill: "Manager", nav: ["Drafts", "Review queue", "Insights", "Settings"] },
  { button: "Legal", pill: "Legal", nav: ["Review queue", "Settings"] },
  { button: "Accessibility", pill: "Accessibility", nav: ["Review queue", "Settings"] },
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
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows an accessible error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("creator@paywise.demo");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#login-error")).toHaveAttribute("role", "alert");
  await expect(page.locator("#login-error")).toContainText("don't match");
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
    await expect(nav).toHaveText(role.nav);
  });
}

test("signed-in users at /login are redirected to /drafts", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/drafts$/);
});

test("demo role switcher changes the signed-in user", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.getByLabel("Switch demo role").selectOption({ label: "Manager" });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.getByTestId("role-pill")).toHaveText("Manager");
});

test("sign out returns to /login", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("non-admins can't open admin pages", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.goto("/vault");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
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
  test.use({ colorScheme: "dark" });

  test("/login has no violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page);
  });

  test("/drafts has no violations", async ({ page }) => {
    await signInAsDemo(page, "Brand admin");
    await expectNoA11yViolations(page);
  });
});
