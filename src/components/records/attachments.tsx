"use client";
// Attachments card for a contact or account: upload box, file list, download, delete.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/components/records/bits";
import { downloadAttachment, deleteAttachment, uploadAttachment } from "@/app/(app)/attachments/actions";
import { ACCEPT_ATTR, MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/attachments";
import type { AttachmentItem } from "@/lib/records/attachments";
import { cn } from "@/components/ui/cn";

export function Attachments({ recordType, recordId, items, canUpload, userId, canDeleteAny }: {
  recordType: "contact" | "account"; recordId: string; items: AttachmentItem[];
  canUpload: boolean; userId: string; canDeleteAny: boolean;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const [working, setWorking] = React.useState<string | null>(null);

  async function upload(files: FileList | File[]) {
    setBusy(true);
    let done = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) { toast.error(`${file.name}: too large (limit ${formatBytes(MAX_ATTACHMENT_BYTES)}).`); continue; }
      const fd = new FormData();
      fd.set("recordType", recordType);
      fd.set("recordId", recordId);
      fd.set("file", file);
      const r = await uploadAttachment(fd);
      if (r.ok) done++; else toast.error(`${file.name}: ${r.error}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done > 0) { toast.success(done === 1 ? "File added." : `${done} files added.`); router.refresh(); }
  }

  async function download(a: AttachmentItem) {
    setWorking(a.id);
    const r = await downloadAttachment(a.id);
    setWorking(null);
    if (!r.ok) return toast.error(r.error);
    window.location.assign(r.url); // short-lived link (about a minute)
  }

  async function remove(a: AttachmentItem) {
    if (!(await confirmDialog({ title: "Delete file?", message: `"${a.fileName}" will be removed for everyone.`, confirmLabel: "Delete", variant: "destructive" }))) return;
    setWorking(a.id);
    const r = await deleteAttachment(a.id);
    setWorking(null);
    if (!r.ok) return toast.error(r.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy && e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
          className={cn("flex flex-col items-center gap-2 rounded-card-inner border border-dashed border-border-strong bg-muted p-5 text-center transition-colors", over && "border-brand bg-brand-tint")}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <UploadCloud className="size-5 text-muted-foreground" />}
          <p className="text-footnote text-muted-foreground">Drop files here, or choose them. PDF, images, Office, CSV or text, up to {formatBytes(MAX_ATTACHMENT_BYTES)} each.</p>
          <input ref={input} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" aria-label="Choose files to attach" onChange={(e) => e.target.files && void upload(e.target.files)} />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>Choose files</Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState size="sm" icon={<FileText />} title="No files yet" hint="Contracts, proposals and other documents will be listed here." />
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{a.fileName}</div>
                <div className="truncate text-footnote text-muted-foreground">{formatBytes(a.sizeBytes)} · {a.uploaderName} · {formatDateTime(a.createdAt)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Download ${a.fileName}`} disabled={working === a.id} onClick={() => void download(a)}>
                  {working === a.id ? <Loader2 className="animate-spin" /> : <Download />}
                </Button>
                {(canDeleteAny || a.uploadedById === userId) && (
                  <Button type="button" size="icon-sm" variant="destructive-ghost" aria-label={`Delete ${a.fileName}`} disabled={working === a.id} onClick={() => void remove(a)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
