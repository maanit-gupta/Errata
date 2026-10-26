import { z } from "zod";

/**
 * Pure env schemas (no process.env access), so they can be unit-tested.
 * Names match CLAUDE.md and `.env.example`. Errors name the variable and never include its value.
 */

// Blank values count as missing.
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const required = () => z.preprocess(blank, z.string({ error: "is required" }).min(1));
const requiredUrl = () => z.preprocess(blank, z.url({ error: "must be a valid URL" }));
const optional = () => z.preprocess(blank, z.string().optional());

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required(),
  NEXT_PUBLIC_SITE_URL: requiredUrl(),
  NEXT_PUBLIC_DEMO_MODE: z.preprocess(
    (v) => blank(v) ?? "false",
    z.stringbool({ error: "must be true or false" }),
  ),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SECRET_KEY: required(),
  DISCORD_WEBHOOK_URL: requiredUrl(),
  RESEND_API_KEY: optional(), // blank = email disabled
  EMAIL_FROM: optional(),
  WORKER_URL: optional(), // optional: pinged on submit to wake a sleeping free-tier worker
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export class EnvError extends Error {
  constructor(issues: z.core.$ZodIssue[]) {
    const lines = issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    super(`Invalid environment variables (see apps/web/.env.example):\n${lines.join("\n")}`);
    this.name = "EnvError";
  }
}

export function parseEnv<S extends z.ZodType>(schema: S, source: Record<string, unknown>) {
  const result = schema.safeParse(source);
  if (!result.success) throw new EnvError(result.error.issues);
  return result.data as z.infer<S>;
}

export const schemas = { client: clientSchema, server: serverSchema };
