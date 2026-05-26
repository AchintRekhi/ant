import { headers } from "next/headers";

/**
 * The origin of the current request (e.g. http://localhost:3000), used to build
 * absolute redirect URLs for Supabase auth emails. Falls back to NEXT_PUBLIC_SITE_URL.
 */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
