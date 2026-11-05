// Loads a record's timeline, newest first, in the shape the Timeline component expects.
import type { Tx } from "@/lib/db";
import type { TimelineItem } from "@/components/records/timeline";

export async function loadTimeline(tx: Tx, recordType: "contact" | "account", recordId: string): Promise<TimelineItem[]> {
  const rows = await tx.activity.findMany({ where: { recordType, recordId }, orderBy: { occurredAt: "desc" }, take: 100 });
  return rows.map((r) => ({
    id: r.id, kind: r.kind, summary: r.summary, body: r.body, actorEmail: r.actorEmail, source: r.source, occurredAt: r.occurredAt.toISOString(),
    changes: (r.detail as { changes?: TimelineItem["changes"] } | null)?.changes,
  }));
}
