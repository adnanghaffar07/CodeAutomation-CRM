"use client";
// CSV import wizard: pick a file, map columns, preview the checks, then send rows in chunks and watch the background job.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createImportBatch, importErrorReport, importStatus, startImport, stageImportRows } from "@/app/(app)/imports/actions";
import { checkRow, IMPORT_FIELDS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, mappingFromIndex, parseCsv, suggestMapping, type ImportKind } from "@/lib/imports";

const CHUNK = 500;

type Parsed = { fileName: string; headers: string[]; rows: string[][] };

export function ImportWizard() {
  const router = useRouter();
  const [kind, setKind] = React.useState<ImportKind>("contact");
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, number>>({});
  const [mode, setMode] = React.useState<"skip" | "fill_blanks">("skip");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [batchId, setBatchId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Awaited<ReturnType<typeof importStatus>> | null>(null);

  async function pickFile(file: File) {
    if (file.size > MAX_IMPORT_BYTES) return toast.error("That file is too large. Split it into smaller files (limit 50 MB).");
    if (!/\.csv$/i.test(file.name)) return toast.error("Upload a .csv file. Excel files: save them as CSV first.");
    setBusy("Reading file…");
    const text = await file.text();
    const p = parseCsv(text);
    setBusy(null);
    if (p.headers.length === 0 || p.rows.length === 0) return toast.error("That file has no data rows.");
    if (p.rows.length > MAX_IMPORT_ROWS) return toast.error(`That file has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. Split it.`);
    setParsed({ fileName: file.name, headers: p.headers, rows: p.rows });
    setMapping(suggestMapping(p.headers, kind));
  }

  function changeKind(k: ImportKind) {
    setKind(k);
    if (parsed) setMapping(suggestMapping(parsed.headers, k));
  }

  const headerMap = parsed ? mappingFromIndex(mapping, parsed.headers) : {};
  const preview = React.useMemo(() => {
    if (!parsed) return null;
    const results = parsed.rows.slice(0, 2000).map((r) => checkRow(kind, parsed.headers, r, headerMap));
    const ok = results.filter((r) => r.ok).length;
    return { ok, bad: results.length - ok, sample: results.slice(0, 5), checked: results.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, kind, mapping]);

  const hasKey = kind === "contact" ? ["email", "fullName", "firstName"].some((f) => f in mapping) : "name" in mapping;

  async function start() {
    if (!parsed) return;
    setBusy("Creating import…");
    const created = await createImportBatch({
      kind, fileName: parsed.fileName, headers: parsed.headers, mapping, duplicateMode: mode, totalRows: parsed.rows.length,
    });
    if (!created.ok) { setBusy(null); return toast.error(created.error); }
    const id = created.id;
    for (let start = 0; start < parsed.rows.length; start += CHUNK) {
      setBusy(`Sending rows ${start + 1}–${Math.min(start + CHUNK, parsed.rows.length)} of ${parsed.rows.length}…`);
      const r = await stageImportRows({ batchId: id, startRow: start + 1, rows: parsed.rows.slice(start, start + CHUNK) });
      if (!r.ok) { setBusy(null); return toast.error(r.error); }
    }
    setBusy("Adding records…");
    const q = await startImport(id);
    setBusy(null);
    if (!q.ok) return toast.error(q.error);
    setBatchId(id);
    toast.success("Import finished.");
    router.refresh();
  }

  // Poll the job until it finishes.
  React.useEffect(() => {
    if (!batchId) return;
    let stop = false;
    const tick = async () => {
      const s = await importStatus(batchId);
      if (stop) return;
      setStatus(s);
      if (s.ok && !s.batch.finished) setTimeout(tick, 2000);
      else router.refresh();
    };
    void tick();
    return () => { stop = true; };
  }, [batchId, router]);

  async function downloadErrors() {
    if (!batchId) return;
    const r = await importErrorReport(batchId);
    if (!r.ok) return toast.error(r.error);
    const url = URL.createObjectURL(new Blob(["﻿" + r.csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = r.fileName; a.click();
    URL.revokeObjectURL(url);
  }

  if (batchId) {
    const b = status?.ok ? status.batch : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{b?.status === "failed" ? "Import failed" : "Import finished"}</CardTitle>
          <CardDescription>{b ? `${b.fileName}: ${b.totalRows.toLocaleString()} rows` : "Checking progress…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {b && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Added" value={b.accepted} />
              <Stat label="Updated" value={b.updated} />
              <Stat label="Duplicates" value={b.duplicates} />
              <Stat label="Rejected" value={b.rejected} />
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            {b?.finished && (b.rejected > 0 || b.duplicates > 0) && <Button variant="outline" onClick={downloadErrors}>Download error report</Button>}
            {b?.finished && <Button onClick={() => { setBatchId(null); setParsed(null); setStatus(null); }}>Import another file</Button>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a file</CardTitle>
          <CardDescription>CSV only. The first row must be column names. Up to {MAX_IMPORT_ROWS.toLocaleString()} rows and 2 MB per file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What are you importing?">
            {(["contact", "account"] as ImportKind[]).map((k) => (
              <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => changeKind(k)} aria-pressed={kind === k}>
                {k === "contact" ? "Contacts" : "Accounts"}
              </Button>
            ))}
          </div>
          <input
            type="file" accept=".csv,text/csv" disabled={!!busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = ""; }}
            className="block w-full text-body file:mr-3 file:rounded-control file:border-0 file:bg-brand-tint file:px-3 file:py-2 file:text-brand-text"
          />
          {busy && <p className="text-footnote text-muted-foreground" role="status">{busy}</p>}
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>2. Match the columns</CardTitle>
            <CardDescription>{parsed.fileName}: {parsed.rows.length.toLocaleString()} rows. Columns we couldn&apos;t match stay unused.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(IMPORT_FIELDS[kind]).map(([field, label]) => (
                <label key={field} className="flex flex-col gap-1 text-footnote">
                  <span className="text-muted-foreground">{label}</span>
                  <select
                    className="h-11 rounded-control border border-input bg-field px-3 text-body md:h-9"
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => {
                      const next = { ...m };
                      if (e.target.value === "") delete next[field];
                      else next[field] = Number(e.target.value);
                      return next;
                    })}
                  >
                    <option value="">Not in this file</option>
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-footnote text-muted-foreground">When a record already exists</legend>
              <label className="flex items-center gap-2 text-body">
                <input type="radio" name="mode" checked={mode === "skip"} onChange={() => setMode("skip")} />
                Skip it and report as a duplicate (recommended)
              </label>
              <label className="flex items-center gap-2 text-body">
                <input type="radio" name="mode" checked={mode === "fill_blanks"} onChange={() => setMode("fill_blanks")} />
                Fill in only the empty fields it has
              </label>
            </fieldset>

            {preview && (
              <div className="space-y-2 rounded-card-inner bg-muted p-3">
                <p className="text-footnote">
                  Checked {preview.checked.toLocaleString()} rows: <strong>{preview.ok.toLocaleString()}</strong> look good
                  {preview.bad > 0 && <>, <span className="text-destructive">{preview.bad.toLocaleString()} will be rejected</span></>}.
                  Duplicates are found when the import runs.
                </p>
                {preview.sample.filter((s) => !s.ok).slice(0, 3).map((s, i) => (
                  <p key={i} className="text-caption text-muted-foreground">• {!s.ok ? s.message : ""}</p>
                ))}
              </div>
            )}

            {!hasKey && (
              <p className="text-footnote text-destructive">{kind === "contact" ? "Match an Email, Full name or First name column." : "Match a Company name column."}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>Choose another file</Button>
              <Button onClick={start} disabled={!hasKey || !!busy}>Start import</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
