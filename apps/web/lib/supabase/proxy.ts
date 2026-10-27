import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import { SKIP_LANDING_COOKIE } from "@/lib/ui-prefs";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login"];
/** Open to everyone, signed in or not: the landing page, public AI-use page and the dev kitchen sink. */
const OPEN_PATHS = ["/ai-use", "/dev"];

/**
 * Refresh the Supabase session cookie on every request and apply the optimistic auth redirects:
 * signed-out → /login, signed-in at /login → /drafts. Pages still check the session themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims(): it refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isOpen =
    pathname === "/" || OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isOpen) {
    // "Skip this page next time?" (DESIGN.md §8): signed-in visitors who opted out go to the app.
    if (pathname === "/" && signedIn && request.cookies.get(SKIP_LANDING_COOKIE)?.value === "1") {
      return redirectKeepingCookies(request, response, "/drafts");
    }
    return response;
  }

  if (!signedIn && !isPublic) {
    return redirectKeepingCookies(request, response, "/login", pathname);
  }
  if (signedIn && isPublic) {
    return redirectKeepingCookies(request, response, "/drafts");
  }
  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  to: string,
  next?: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  if (next && next !== "/") url.searchParams.set("next", next);
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
