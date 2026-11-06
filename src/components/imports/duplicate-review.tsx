"use client";
// Lists the duplicates an import found, so each can be merged into the record it matches (or left alone).
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importDuplicates, mergeImportRow, type DuplicateRow } from "@/app/(app)/imports/duplicates-actions";

export function DuplicateReview({ batchId, onChanged }: { batchId: string; onChanged: () => Promise<void> | void }) {
  const [rows, setRows] = React.useState<DuplicateRow[] | null>(null);
  const [kind, setKind] = React.useState<string>("contact");
  const [working, setWorking] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const r = await importDuplicates(batchId);
    if (!r.ok) return setError(r.error);
    setKind(r.kind);
    setRows(r.rows);
  }, [batchId]);

  React.useEffect(() => { void load(); }, [load]);

  async function merge(row: DuplicateRow) {
    setWorking(row.id);
    const r = await mergeImportRow(row.id);
    setWorking(null);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.changed.length ? `Merged into ${row.recordName ?? "the existing record"}.` : "Nothing was empty to fill; existing values kept.");
    await load();
    await onChanged();
  }

  if (error) return <p className="text-footnote text-destructive" role="alert">{error}</p>;
  if (!rows) return <p className="text-footnote text-muted-foreground" role="status">Loading duplicates…</p>;
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-card-inner bg-muted p-4" aria-label="Duplicates">
      <div>
        <h3 className="text-headline">Duplicates ({rows.length})</h3>
        <p className="text-footnote text-muted-foreground">
          These rows matched a {kind === "contact" ? "contact" : "account"} that already exists. Merge fills only the empty fields of that record; nothing is overwritten.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-footnote">
            <span className="min-w-0">
              <span className="block truncate">Row {row.rowNumber}: {row.summary || "(empty)"}</span>
              <span className="block text-muted-foreground">
                {row.canMerge
                  ? `Matches: ${row.recordName ?? "a record"}`
                  : row.message?.includes("earlier in this file")
                    ? "Repeats a row earlier in this file."
                    : "Matches a record you can't see. Ask a manager to review it."}
              </span>
            </span>
            {row.canMerge && (
              <Button variant="outline" onClick={() => merge(row)} disabled={!!working}>
                {working === row.id ? "Merging…" : "Merge"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
