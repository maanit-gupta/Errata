import { parseEnv, schemas, type ClientEnv, type ServerEnv } from "./env-schema";

/**
 * Validated environment.
 *
 * - `clientEnv` is safe anywhere. Each NEXT_PUBLIC_* var is referenced literally
 *   so Next.js can inline it into the browser bundle.
 * - `serverEnv()` is server-only and holds secrets. It throws if called in the
 *   browser, and it is never passed to client components.
 */

export { EnvError, type ClientEnv, type ServerEnv } from "./env-schema";

export const clientEnv: ClientEnv = parseEnv(schemas.client, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
});

let cachedServerEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  cachedServerEnv ??= parseEnv(schemas.server, process.env);
  return cachedServerEnv;
}
