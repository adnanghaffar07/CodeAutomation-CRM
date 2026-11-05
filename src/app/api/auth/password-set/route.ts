// Records that a person chose their password (after an invite or reset link). The password itself goes
// straight from the browser to Supabase Auth and never reaches this server.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No active access to this workspace", code: "no_access" }, { status: 403 });
  await withScope(user.scope, (tx) => audit(tx, user.scope, { action: "auth.password_set", entityType: "user", entityId: user.userId }));
  return NextResponse.json({ ok: true });
}
