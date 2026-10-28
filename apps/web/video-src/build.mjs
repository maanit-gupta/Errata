// Builds composition/index.html from index.template.html (brag-plan.md has the storyboard).
// Usage (from apps/web): node video-src/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "composition");
const read = (f) => readFileSync(join(DIR, f), "utf8");
const TEMPLATE = readFileSync(join(DIR, "..", "index.template.html"), "utf8");

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OCTAGON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const TRIANGLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
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

const badge = (sev) =>
  sev === "blocker"
    ? `<div class="badge blocker">${OCTAGON}Blocker</div>`
    : `<div class="badge warning">${TRIANGLE}Warning</div>`;
const facts = (id, ids, sev, dim, quote) => `<div id="${id}-facts" class="facts">
          <div class="ids">${ids.map((x) => `<span class="id mono">${x}</span>`).join("")}</div>
          ${badge(sev)}
          <div class="dim">${dim}</div>
          <div class="quote mono">${quote}</div>
        </div>`;
const frame = (id, img, w, h) => `<div id="${id}-frame" class="frame right">
          <div id="${id}-zoom" class="zoom" data-layout-allow-overflow style="width: ${w}px; height: ${h}px"><img src="shots/${img}" width="${w}" height="${h}" alt="" /></div>
        </div>`;
const cap = (id, text) => `<div id="${id}-cap" class="caption">${text}</div>`;

const FINDINGS = [
  facts("fa", ["CL-03", "F-112"], "blocker", "Claims", "“lock in 14.2% assured annual returns”"),
  frame("fa", "card-CL-03.png", 800, 1330),
  cap(
    "fa",
    "CL-03: “assured returns” on a market-linked fund, quoting F-112 without its disclaimer.",
  ),
  facts("fb", ["E-19"], "blocker", "Facts", "“Oct 18 at Hall B, Chandigarh”"),
  frame("fb", "card-E-19.png", 800, 922),
  cap("fb", "E-19: Oct 18 at Hall B belongs to another campaign. Caught without AI judgement."),
  facts("fc", ["G-07"], "warning", "Terms", "“Paywise app”"),
  frame("fc", "card-G-07.png", 800, 860),
  cap("fc", "G-07: the brand is written PayWise, not “Paywise app”."),
  facts("fd", ["WCAG 1.4.3", "A-02"], "warning", "Access · poster image", "Contrast 2.89 : 1"),
  `<div id="fd-frameA" class="frame right" style="left: 960px; width: 700px">
          <div id="fd-zoomA" class="zoom" data-layout-allow-overflow style="width: 2880px; height: 1800px"><img src="shots/07-image.png" width="2880" height="1800" alt="" /></div>
        </div>
        <div id="fd-frameB" class="frame right">
          <div id="fd-zoomB" class="zoom" data-layout-allow-overflow style="width: 800px; height: 846px; background: #ffffff"><img src="shots/card-WCAG-1.4.3.png" width="800" height="846" alt="" /></div>
        </div>`,
  cap("fd", "WCAG 1.4.3: poster text at 2.89 : 1. Large text needs 3 : 1."),
].join("\n        ");

const hero = read("hero-scene.svg").replace(/ class="[^"]*"/, "");

const html = TEMPLATE.replace("{{HERO_SVG}}", hero)
  .replace("{{TICKS}}", TICKS)
  .replace("{{STAGES}}", STAGES)
  .replace("{{FINDINGS}}", FINDINGS)
  .replaceAll("{{SMALLTICK}}", `<span class="tick">${CHECK}</span>`);
writeFileSync(join(DIR, "index.html"), html);
console.log("wrote composition/index.html", html.length, "bytes");
