import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TextCursorInput } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FieldsPanel, type FieldRow } from "@/components/settings/fields-panel";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "Custom fields" };
export const dynamic = "force-dynamic";

export default async function FieldsPage() {
  const me = await requireUser();
  if (!can(me.role, "settings.access")) redirect("/");
  const defs = await withScope(me.scope, (tx) => tx.customFieldDef.findMany({ orderBy: [{ entity: "asc" }, { position: "asc" }] }));
  const rows: FieldRow[] = defs.map((d) => ({ id: d.id, entity: d.entity, label: d.label, type: d.type, options: d.options }));
  return (
    <>
      <PageHeader title="Custom fields" subtitle="Extra details you want on every contact or account." icon={<TextCursorInput />} />
      <FieldsPanel rows={rows} />
    </>
  );
}
