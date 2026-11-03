// Builds the Round 3 "What's new" video composition (storyboard: docs/video/README.md).
// Copies the shared fonts, GSAP and the real-app shots from ../composition (git-ignored copies),
// then writes index.html from ../round3.template.html.
// Usage (from apps/web): node video-src/round3/build.mjs
//   then: cd video-src/round3 && npx hyperframes@0.8.212 render . -o renders/errata-whats-new.mp4
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const V1 = join(DIR, "..", "composition");

function copy(from, to) {
  mkdirSync(dirname(join(DIR, to)), { recursive: true });
  copyFileSync(join(V1, from), join(DIR, to));
}
for (const f of ["DMMono-400-latin.woff2", "DMMono-500-latin.woff2", "DMSans-variable-latin.woff2"])
  copy(`fonts/${f}`, `fonts/${f}`);
copy("vendor/gsap.min.js", "vendor/gsap.min.js");
// Real-app captures from the first video (capture.mjs, local stack, demo roles).
for (const f of [
  "01-write.png",
  "card-CL-03.png",
  "card-E-19.png",
  "04-legal.png",
  "05-signoff.png",
])
  copy(`shots/${f}`, `shots/v1/${f}`);

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OCTAGON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const tick = (id, style = "") => `<div id="${id}" class="tick"${style}>${CHECK}</div>`;

// Intent fields in 01-write.png (2x px): Goal, Audience, Call to action, Channel, Campaign.
const FIELD_Y = [660, 861, 1066, 1272, 1437];
const TICKS = FIELD_Y.map((y, i) =>
  tick(`t${i + 1}`, ` style="left: 1002px; top: ${y - 38}px"`),
).join("\n            ");

const STAGES = [
  ["01", "Ingest", "Read the text, file or image.", ""],
  ["02", "Protect", "Redact personal data and secrets.", ""],
  ["03", "Filters", "Rule checks without AI: facts, terms, claims, contrast.", ""],
  ["04", "Retrieve", "Find the approved rules and facts that apply.", ""],
  ["05", "AI pass", "One AI call judges tone and claims.", " ai"],
  [
    "06",
    "Citation gate",
    "Keep a flag only if its rule was found and its quote is in the draft.",
    " gate",
  ],
]
  .map(
    ([n, h, p, cls], i) => `<div id="st${i + 1}" class="stage${cls}">
            <div class="num mono">${n}</div>
            <h3>${h}</h3>
            <p>${p}</p>
            ${tick(`st${i + 1}-tick`)}
          </div>`,
  )
  .join("\n          ");

const NEW = [
  "AI check pending",
  "Cross-check: image, caption, landing page",
  "Contrast fixes from your palette",
  "Publish receipt and fact kill-switch",
  "Clarity backtest on real reviews",
  "Read-only MCP server",
]
  .map(
    (t, i) =>
      `<div id="n${i + 1}" class="newrow">${tick(`n${i + 1}-tick`)}<span class="mono">0${i + 1}</span>${t}</div>`,
  )
  .join("\n          ");

const TOOLS = ["get_campaign_context", "precheck_draft_fast", "verify_claim_evidence"]
  .map(
    (t, i) =>
      `<div id="tool${i + 1}" class="chip mono">${t}<span class="tick">${CHECK}</span></div>`,
  )
  .join("\n          ");

const hero = readFileSync(join(V1, "hero-scene.svg"), "utf8").replace(/ class="[^"]*"/, "");
const html = readFileSync(join(DIR, "..", "round3.template.html"), "utf8")
  .replace("{{HERO_SVG}}", hero)
  .replace("{{TICKS}}", TICKS)
  .replace("{{STAGES}}", STAGES)
  .replace("{{NEW}}", NEW)
  .replace("{{TOOLS}}", TOOLS)
  .replaceAll("{{OCTAGON}}", OCTAGON)
  .replaceAll("{{SMALLTICK}}", `<span class="tick">${CHECK}</span>`);
writeFileSync(join(DIR, "index.html"), html);
console.log("wrote round3/index.html", html.length, "bytes");
