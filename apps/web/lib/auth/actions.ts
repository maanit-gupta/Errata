"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_USERS, isDemoUserKey } from "@/lib/auth/demo-users";
import { clientEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { FLASH_COOKIE } from "@/lib/ui-prefs";

// Demo-only credential for the fictional seeded users (README "Demo accounts"). Used only when
// NEXT_PUBLIC_DEMO_MODE=true; never sent to the browser.
const DEMO_PASSWORD = "PayWise-demo-2026";

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
};

const credentials = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only same-origin relative paths; never "//evil.example".
  return next.startsWith("/") && !next.startsWith("//") ? next : "/drafts";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    return {
      email,
      fieldErrors: { email: fields.email?.[0], password: fields.password?.[0] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { email, error: "That email and password don't match an account." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signInAsDemo(formData: FormData): Promise<void> {
  if (!clientEnv.NEXT_PUBLIC_DEMO_MODE) throw new Error("Demo mode is disabled");
  const key = formData.get("user");
  if (!isDemoUserKey(key)) throw new Error("Unknown demo user");
  const user = DEMO_USERS.find((u) => u.key === key)!;

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: DEMO_PASSWORD,
  });
  if (error) redirect("/login?error=demo");
  (await cookies()).set(FLASH_COOKIE, `Now viewing as ${user.label}`, {
    path: "/",
    maxAge: 60,
    httpOnly: false,
  });
  redirect(user.role === "specialist" ? "/review" : "/drafts");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
