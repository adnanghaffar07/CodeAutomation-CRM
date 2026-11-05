// Supabase admin client (secret key). SERVER ONLY: never import from a client component.
// Used for user management: create/invite users, generate one-time links, ban/unban.
import { createClient } from "@supabase/supabase-js";

export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (Supabase → Project Settings → API Keys → Secret key)");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
