// One-time link landing (invite or password reset). The link carries a single-use token hash; verifying it
// signs the person in (session cookie) and sends them to choose a password. No email service is involved:
// an admin copies the link from Settings → Users and sends it to the person themselves.
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email"];

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));

  if (!tokenHash || !type || !TYPES.includes(type)) return to("/login?error=link");
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return to("/login?error=link");
  return to("/set-password");
}
