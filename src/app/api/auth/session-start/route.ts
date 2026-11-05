// Called by the sign-in form right after Supabase accepts the password. It confirms the person has an
// ACTIVE CRM membership (a suspended or unknown account is refused here) and records the sign-in.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No active access to this workspace", code: "no_access" }, { status: 403 });
  await withScope(user.scope, (tx) => audit(tx, user.scope, { action: "auth.login", entityType: "user", entityId: user.userId }));
  return NextResponse.json({ ok: true });
}
