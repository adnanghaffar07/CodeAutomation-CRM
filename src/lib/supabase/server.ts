// Supabase Auth client for server components, route handlers and server actions.
// It reads and writes the session cookies; it is NOT used to read our tables (that goes through Prisma + RLS).
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { cookies } from "next/headers";

export function createServerSupabase() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: CookieToSet[]) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component: cookies are read-only there. The middleware refreshes the session instead.
        }
      },
    },
  });
}
