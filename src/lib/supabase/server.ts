import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route Handlers.
 *
 * Next.js 16: `cookies()` is async and must be awaited, so this helper is async too.
 * Session refresh happens in `src/proxy.ts`; the empty catch below is intentional —
 * `cookieStore.set` throws when called from a Server Component render, which is safe
 * to ignore because the proxy already wrote refreshed cookies on the response.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore; proxy.ts handles refresh.
          }
        },
      },
    },
  );
}
