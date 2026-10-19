import { createServerClient } from "@supabase/ssr";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const isDemo = () => process.env.DEMO_MODE === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Per-request client acting as the signed-in user (RLS applies). */
export async function serverClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* called from a Server Component; middleware refreshes the session */
        }
      },
    },
  });
}

/** Service-role client for cron, OAuth callbacks and MCP. Bypasses RLS: always filter by user_id. */
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
