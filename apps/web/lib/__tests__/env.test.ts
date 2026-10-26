import { describe, expect, it } from "vitest";
import { EnvError, parseEnv, schemas } from "@/lib/env-schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_DEMO_MODE: "true",
  SUPABASE_SECRET_KEY: "sk-do-not-leak",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/x",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
};

describe("env", () => {
  it("parses a valid server env and coerces demo mode", () => {
    const env = parseEnv(schemas.server, valid);
    expect(env.NEXT_PUBLIC_DEMO_MODE).toBe(true);
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("names a missing variable", () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.SUPABASE_SECRET_KEY;
    expect(() => parseEnv(schemas.server, rest)).toThrowError(/SUPABASE_SECRET_KEY/);
  });

  it("treats a blank value as missing", () => {
    expect(() =>
      parseEnv(schemas.server, { ...valid, NEXT_PUBLIC_SUPABASE_URL: " " }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("never includes values in the error", () => {
    try {
      parseEnv(schemas.server, { ...valid, DISCORD_WEBHOOK_URL: "sk-do-not-leak" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      expect(String(e)).not.toContain("sk-do-not-leak");
    }
  });
});
