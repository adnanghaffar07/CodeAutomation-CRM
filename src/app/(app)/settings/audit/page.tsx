import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE = 50;

// Keyset pagination: "older than this row" keeps every page cheap however large the log grows.
export default async function AuditPage({ searchParams }: { searchParams: { before?: string; action?: string } }) {
  const me = await requireUser();
  if (!can(me.role, "audit.read")) redirect("/");
  const before = searchParams.before && !Number.isNaN(Date.parse(searchParams.before)) ? new Date(searchParams.before) : undefined;
  const action = searchParams.action && /^[a-z_.]{1,60}$/.test(searchParams.action) ? searchParams.action : undefined;

  const rows = await withScope(me.scope, (tx) =>
    tx.auditLog.findMany({
      where: { ...(before ? { createdAt: { lt: before } } : {}), ...(action ? { action: { startsWith: action } } : {}) },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    }),
  );
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const next = more ? page[page.length - 1].createdAt.toISOString() : null;
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every sign-in, access change and credential change. Entries can't be edited or deleted." icon={<ScrollText />} />
      {page.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No entries yet" hint="Activity appears here as people sign in and change things." />
      ) : (
        <div className="overflow-hidden rounded-card bg-card shadow-e1">
          <Table>
            <TableHeader>
              <TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {page.map((r) => {
                const meta = r.meta as Record<string, unknown> | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-footnote text-muted-foreground">{fmt.format(r.createdAt)}</TableCell>
                    <TableCell>{r.actorEmail ?? "System"}</TableCell>
                    <TableCell><code className="text-footnote">{r.action}</code></TableCell>
                    <TableCell className="max-w-[420px] truncate text-footnote text-muted-foreground">{meta ? Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {next && (
        <div className="mt-4 flex justify-center">
          <Link href={`/settings/audit?before=${encodeURIComponent(next)}${action ? `&action=${action}` : ""}`} className="text-body font-medium text-brand-text hover:underline">
            Older entries
          </Link>
        </div>
      )}
    </>
  );
}
