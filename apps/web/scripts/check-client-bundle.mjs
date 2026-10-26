// Fails if any server-only secret value appears in the client bundle (.next/static).
// Reads values from process.env, falling back to .env.local. Prints variable NAMES only.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECRET_NAMES = ["SUPABASE_SECRET_KEY", "DISCORD_WEBHOOK_URL", "RESEND_API_KEY"];
const STATIC_DIR = ".next/static";

function readDotenv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

if (!existsSync(STATIC_DIR)) {
  console.error(`${STATIC_DIR} not found; run \`pnpm build\` first.`);
  process.exit(2);
}

const dotenv = readDotenv(".env.local");
const secrets = SECRET_NAMES.map((name) => [name, process.env[name] || dotenv[name] || ""]).filter(
  ([, v]) => v.length >= 8,
);

let leaks = 0;
let scanned = 0;
for (const file of files(STATIC_DIR)) {
  const text = readFileSync(file, "utf8");
  scanned += 1;
  for (const [name, value] of secrets) {
    if (text.includes(value)) {
      console.error(`LEAK: ${name} found in ${file}`);
      leaks += 1;
    }
  }
  if (text.includes("SUPABASE_SECRET_KEY")) {
    console.error(`LEAK: the name SUPABASE_SECRET_KEY appears in ${file}`);
    leaks += 1;
  }
}
console.log(
  `Scanned ${scanned} client files for ${secrets.map(([n]) => n).join(", ")}: ${leaks} leak(s).`,
);
process.exit(leaks ? 1 : 0);
