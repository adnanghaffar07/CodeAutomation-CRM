// Pure rules for file attachments: size limit, allowed types, file-name cleaning, storage paths.
// No imports from session/db so vitest can load it.

export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_SECONDS = 60;

type Sig = { offset: number; bytes: number[] }[];
type TypeRule = { mime: string; sig: Sig | "text" };

const ZIP: Sig = [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }];
const OLE: Sig = [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }];

/** Allowed extensions, the MIME type we store for each, and how the first bytes must look. */
export const ALLOWED_TYPES: Record<string, TypeRule> = {
  pdf: { mime: "application/pdf", sig: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }] },
  png: { mime: "image/png", sig: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }] },
  jpg: { mime: "image/jpeg", sig: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  jpeg: { mime: "image/jpeg", sig: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  gif: { mime: "image/gif", sig: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }] },
  webp: { mime: "image/webp", sig: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }] },
  doc: { mime: "application/msword", sig: OLE },
  xls: { mime: "application/vnd.ms-excel", sig: OLE },
  ppt: { mime: "application/vnd.ms-powerpoint", sig: OLE },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sig: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sig: ZIP },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sig: ZIP },
  csv: { mime: "text/csv", sig: "text" },
  txt: { mime: "text/plain", sig: "text" },
};

export const ACCEPT_ATTR = Object.keys(ALLOWED_TYPES).map((e) => `.${e}`).join(",");

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** A file name safe to store and show: no path parts, no control or odd characters, bounded length, keeps the extension. */
export function sanitizeFileName(raw: string): string {
  let n = (raw ?? "").normalize("NFKC").split(/[\\/]/).pop() ?? "";
  n = n.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/\s+/g, " ").trim();
  n = n.replace(/^[.\s]+/, ""); // no hidden files or leading dots
  const ext = extensionOf(n);
  let base = ext ? n.slice(0, n.length - ext.length - 1) : n;
  base = base.replace(/[. ]+$/, "");
  if (!base || /^[_ -]+$/.test(base)) base = "file";
  base = base.slice(0, 100);
  return ext ? `${base}.${ext.slice(0, 10)}` : base;
}

export function storagePathFor(workspaceId: string, recordType: string, recordId: string, uuid: string, safeName: string): string {
  return `${workspaceId}/${recordType}/${recordId}/${uuid}-${safeName}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const matches = (head: Uint8Array, sig: Sig) => sig.every(({ offset, bytes }) => bytes.every((b, i) => head[offset + i] === b));

export type FileCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string };

/**
 * Decides whether a file may be stored. The extension must be on the allow-list and the first bytes must
 * match that type; the browser's own MIME label is ignored (it is trivially forged).
 */
export function checkUpload(fileName: string, size: number, head: Uint8Array, opts: { skipContent?: boolean } = {}): FileCheck {
  if (size <= 0) return { ok: false, error: "That file is empty." };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: `That file is too large (limit ${formatBytes(MAX_ATTACHMENT_BYTES)}).` };
  const ext = extensionOf(fileName);
  const rule = ALLOWED_TYPES[ext];
  if (!rule) return { ok: false, error: "That file type isn't allowed. Use PDF, images, Office documents, CSV or text." };
  if (opts.skipContent) return { ok: true, mime: rule.mime, ext };
  if (rule.sig === "text") {
    if (head.includes(0)) return { ok: false, error: `That doesn't look like a real .${ext} file.` };
  } else if (!matches(head, rule.sig)) {
    return { ok: false, error: `That doesn't look like a real .${ext} file.` };
  }
  return { ok: true, mime: rule.mime, ext };
}

/** Uploader, or anyone who sees everything (manager, CEO/Admin), may delete. */
export function canDeleteAttachment(role: string, userId: string, uploadedById: string): boolean {
  return uploadedById === userId || role === "ceo_admin" || role === "manager";
}
