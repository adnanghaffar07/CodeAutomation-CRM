import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CredentialsPanel, type CredentialRow } from "@/components/settings/credentials-panel";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import type { Provider } from "@/lib/providers";

export const metadata: Metadata = { title: "Integration credentials" };
export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  const me = await requireUser();
  if (!can(me.role, "integrations.manage")) redirect("/");
  // The ciphertext column is deliberately not selected: secrets never leave the server.
  const rows = await withScope(me.scope, (tx) =>
    tx.integrationCredential.findMany({ select: { id: true, provider: true, label: true, hint: true, updatedAt: true }, orderBy: [{ provider: "asc" }, { label: "asc" }] }),
  );
  const list: CredentialRow[] = rows.map((r) => ({ id: r.id, provider: r.provider as Provider, label: r.label, hint: r.hint, updatedAt: r.updatedAt.toISOString() }));
  return (
    <>
      <PageHeader title="Integration credentials" subtitle="Keys are encrypted before they are stored and are never shown again." icon={<KeyRound />} />
      <CredentialsPanel rows={list} />
    </>
  );
}
