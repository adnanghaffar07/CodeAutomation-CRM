import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";

export async function POST() {
  const user = await currentUser();
  if (user) await withScope(user.scope, (tx) => audit(tx, user.scope, { action: "auth.logout", entityType: "user", entityId: user.userId }));
  await createServerSupabase().auth.signOut();
  return NextResponse.json({ ok: true });
}
