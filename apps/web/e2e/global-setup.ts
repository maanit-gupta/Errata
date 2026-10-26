import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warm the local stack before the suite: sign in once and wait until the app loads a session
 * (locally, the first request after an idle period can hit PostgREST's PGRST303 "JWT issued at
 * future" for a few seconds).
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const deadline = Date.now() + 60_000;
  try {
    while (Date.now() < deadline) {
      await page.goto("/login");
      const demo = page.getByRole("button", { name: "Creator", exact: true });
      if (await demo.count()) {
        await demo.click();
        await page.waitForLoadState("networkidle").catch(() => {});
        if (/\/drafts$/.test(page.url()) && (await page.getByTestId("role-pill").count())) return;
      } else return; // demo mode off: nothing to warm
      await page.context().clearCookies();
      await page.waitForTimeout(1500);
    }
  } finally {
    await browser.close();
  }
}
