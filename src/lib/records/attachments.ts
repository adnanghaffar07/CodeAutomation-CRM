// Reads attachment rows for a record (runs inside withScope, so the database rules decide what is visible).
import type { Tx } from "@/lib/db";

export type AttachmentItem = {
  id: string; fileName: string; mimeType: string; sizeBytes: number;
  uploadedById: string; uploaderName: string; createdAt: string;
};

export async function loadAttachments(tx: Tx, recordType: "contact" | "account", recordId: string): Promise<AttachmentItem[]> {
  const rows = await tx.attachment.findMany({
    where: { recordType, recordId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedById: true, createdAt: true },
  });
  const ids = Array.from(new Set(rows.map((r) => r.uploadedById)));
  const members = ids.length ? await tx.workspaceMember.findMany({ where: { userId: { in: ids } }, select: { userId: true, fullName: true, email: true } }) : [];
  const name = new Map(members.map((m) => [m.userId, m.fullName || m.email]));
  return rows.map((r) => ({ ...r, uploaderName: name.get(r.uploadedById) ?? "Unknown", createdAt: r.createdAt.toISOString() }));
}
