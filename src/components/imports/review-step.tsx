"use client";
// Review before importing (like HANDLL's dedupe preview): every matching row gets Merge or Skip, then the import runs.
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewRow } from "@/app/(app)/imports/duplicates-actions";

export type Decision = "merge" | "skip";

export function ReviewStep({ kind, rows, busy, onRun, onBack }: {
  kind: string; rows: PreviewRow[]; busy: boolean;
  onRun: (decisions: Record<string, Decision>) => void; onBack: () => void;
}) {
  const matches = rows.filter((r) => r.status === "match");
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>(() =>
    Object.fromEntries(matches.map((r) => [String(r.rowNumber), "skip" as Decision])),
  );
  const count = (s: PreviewRow["status"]) => rows.filter((r) => r.status === s).length;
  const toImport = count("new") + matches.filter((r) => decisions[String(r.rowNumber)] === "merge").length;
  const setAll = (d: Decision) => setDecisions(Object.fromEntries(matches.map((r) => [String(r.rowNumber), d])));

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Review before importing</CardTitle>
        <CardDescription>Checked {rows.length.toLocaleString()} rows against your {kind === "contact" ? "contacts" : "companies"}. Nothing is saved until you press Import.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="New" value={count("new")} />
          <Stat label="Already exists" value={matches.length} />
          <Stat label="Can't see" value={count("hidden")} />
          <Stat label="Repeats" value={count("repeat")} />
          <Stat label="Invalid" value={count("invalid")} />
        </dl>

        {matches.length > 0 && (
          <section className="space-y-3 rounded-card-inner bg-muted p-4" aria-label="Rows that match an existing record">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-headline">Already in the CRM ({matches.length})</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAll("merge")}>Merge all</Button>
                <Button variant="outline" size="sm" onClick={() => setAll("skip")}>Skip all</Button>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {matches.map((r) => {
                const d = decisions[String(r.rowNumber)] ?? "skip";
                return (
                  <li key={r.rowNumber} className="flex flex-wrap items-center justify-between gap-3 py-3 text-footnote">
                    <span className="min-w-0">
                      <span className="block truncate">Row {r.rowNumber}: {r.summary || "(empty)"}</span>
                      <span className="block text-muted-foreground">Matches: {r.recordName ?? "an existing record"}</span>
                    </span>
                    <span className="flex gap-2" role="group" aria-label={`Row ${r.rowNumber} decision`}>
                      {(["merge", "skip"] as Decision[]).map((x) => (
                        <Button
                          key={x} size="sm" variant={d === x ? "default" : "outline"} aria-pressed={d === x}
                          onClick={() => setDecisions((prev) => ({ ...prev, [String(r.rowNumber)]: x }))}
                        >
                          {x === "merge" ? "Merge" : "Skip"}
                        </Button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-caption text-muted-foreground">Merge fills only the empty fields of the existing record. Skip leaves it alone.</p>
          </section>
        )}

        {count("hidden") > 0 && <p className="text-footnote text-muted-foreground">{count("hidden")} row(s) match a record you can&apos;t see. They will be skipped; ask a manager to review them.</p>}
        {count("repeat") > 0 && <p className="text-footnote text-muted-foreground">{count("repeat")} row(s) repeat an earlier row in this file. Only the first is imported.</p>}
        {count("invalid") > 0 && <p className="text-footnote text-muted-foreground">{count("invalid")} row(s) are invalid and will be rejected. You can download them after the import.</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy}>Back</Button>
          <Button onClick={() => onRun(decisions)} disabled={busy || toImport === 0} aria-busy={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Importing…" : `Import ${toImport.toLocaleString()} row${toImport === 1 ? "" : "s"}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card-inner bg-muted p-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-title3 tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
