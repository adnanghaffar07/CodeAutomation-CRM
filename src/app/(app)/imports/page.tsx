import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/imports/import-wizard";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "Imports" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireUser();
  if (!can(me.role, "imports.use")) redirect("/");
  const recent = await withScope(me.scope, (tx) => tx.importBatch.findMany({
    orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, fileName: true, recordType: true, status: true, totalRows: true, accepted: true, updated: true, duplicates: true, rejected: true, createdAt: true },
  }));
  return (
    <>
      <PageHeader title="Imports" subtitle="Bring CSV data in, safely." icon={<Upload />} />
      <ImportWizard />
      <section className="mt-8 space-y-3">
        <h2 className="text-headline">Recent imports</h2>
        {recent.length === 0 ? (
          <p className="text-footnote text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-card bg-card shadow-e1">
            {recent.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-footnote">
                <span className="min-w-0 truncate">
                  <strong className="font-medium">{b.fileName}</strong> · {b.recordType === "contact" ? "contacts" : "accounts"} · {b.totalRows.toLocaleString()} rows
                </span>
                <span className="text-muted-foreground">
                  {b.status === "done" ? `${b.accepted} added, ${b.updated} updated, ${b.duplicates} duplicates, ${b.rejected} rejected` : b.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
