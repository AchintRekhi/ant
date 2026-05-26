import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy` (Node runtime). This:
 *   1. Keeps the Supabase auth session fresh by reading/rewriting auth cookies.
 *   2. Does optimistic route protection — redirect logged-out users away from
 *      protected areas, and logged-in users away from the auth pages.
 *
 * Onboarding-complete gating is NOT done here (it needs a DB read); that lives
 * in the /app layout via the DAL. Proxy only checks session presence.
 */

// Areas that require a session.
const PROTECTED_PREFIXES = ["/app", "/onboarding"];
// Pages a signed-in user shouldn't see. (/reset-password is excluded — it runs
// inside the recovery session.)
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so expired tokens are refreshed and cookies updated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  const isAuthPage = AUTH_PAGES.includes(path);

  if (!user && isProtected) {
    return redirectKeepingCookies(request, response, "/login");
  }
  if (user && isAuthPage) {
    return redirectKeepingCookies(request, response, "/app");
  }

  return response;
}

// Redirect while preserving any auth cookies written during session refresh.
function redirectKeepingCookies(
  request: NextRequest,
  refreshed: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  refreshed.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
