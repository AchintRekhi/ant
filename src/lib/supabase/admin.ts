import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. **Bypasses RLS** and can reach the Auth admin
 * API, so it must never touch the browser — only trusted server actions / route
 * handlers may use it. The single legitimate use today is account deletion,
 * which has to remove the `auth.users` row (impossible with a user session).
 *
 * No cookies, no session persistence: this client is stateless and unscoped.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
