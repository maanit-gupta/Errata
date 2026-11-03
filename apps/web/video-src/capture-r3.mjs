// Captures the Round 3 components for the "What's new" video (docs/video/README.md).
// Source: the dev kitchen sink (/dev/kitchen-sink), which renders the real components with the
// sample data in app/dev/kitchen-sink/samples.ts. Light theme only, 3x (badges are scaled up in the video).
// Output: video-src/round3/shots/r3-*.png
// Usage (from apps/web, with `pnpm dev` running): node video-src/capture-r3.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "round3", "shots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
mkdirSync(OUT, { recursive: true });

// Light column only, one component per row, no dev overlays or carets.
const CSS = `[data-theme="dark"] { display: none !important; }
  main > div.grid { display: block !important; }
  nextjs-portal, [data-sonner-toaster] { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }`;

// CHROMIUM_PATH: use an already-installed browser when Playwright's own download is missing.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({
  viewport: { width: 860, height: 1200 },
  deviceScaleFactor: 3,
  reducedMotion: "reduce",
  colorScheme: "light",
});
await ctx.addCookies([{ name: "bl_theme", value: "light", url: BASE }]);
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
await page.goto(`${BASE}/dev/kitchen-sink`);
await page.waitForLoadState("networkidle");
await page.addStyleTag({ content: CSS });
await page.waitForTimeout(500);

const light = page.locator('div[data-theme="light"]');
const section = (title) =>
  light.locator("section").filter({ has: page.locator("h2", { hasText: title }) });
const item = (title, n) => section(title).locator(":scope > *:not(h2)").nth(n);
async function shot(name, target) {
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("saved", name);
}

await shot("r3-pending", light.locator('[role="status"]').filter({ hasText: "AI check pending" }));
await shot("r3-shadow", item("GCS shadow backtest", 0));
await shot("r3-receipt", item("Publish receipt and kill-switch", 0));
await shot("r3-receipt-revoked", item("Publish receipt and kill-switch", 1));
await shot("r3-autoheal", item("Visual auto-heal preview", 0));
await shot("r3-mcp", item("AI tools (MCP) card", 0));

await browser.close();
