"use client";
// Define extra fields for contacts and accounts (CEO/Admin). Values are typed on the record pages.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TextCursorInput } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createCustomField, deleteCustomField } from "@/app/(app)/views/actions";

export type FieldRow = { id: string; entity: "contact" | "account"; label: string; type: string; options: string[] };

const TYPE_LABEL: Record<string, string> = { text: "Text", number: "Number", date: "Date", select: "Choice" };

export function FieldsPanel({ rows }: { rows: FieldRow[] }) {
  const router = useRouter();
  const [entity, setEntity] = React.useState<"contact" | "account">("contact");
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState("text");
  const [options, setOptions] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await createCustomField({ entity, label, type: type as never, options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [] });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Field added");
    setLabel(""); setOptions("");
    router.refresh();
  }

  async function remove(f: FieldRow) {
    if (!(await confirmDialog({ title: `Remove "${f.label}"?`, message: "The field disappears from the forms. Values already saved on records are kept in their data.", confirmLabel: "Remove", variant: "destructive" }))) return;
    const r = await deleteCustomField(f.id);
    if (!r.ok) toast.error(r.error); else router.refresh();
  }

  const group = (e: "contact" | "account") => rows.filter((r) => r.entity === e);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {(["contact", "account"] as const).map((e) => (
          <section key={e}>
            <h2 className="mb-2 text-headline font-semibold text-foreground">{e === "contact" ? "Contact fields" : "Account fields"}</h2>
            {group(e).length === 0 ? (
              <EmptyState size="sm" icon={<TextCursorInput />} title="No custom fields" hint="Add one on the right. It appears on every record form." />
            ) : (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-card shadow-e1">
                {group(e).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{f.label}</div>
                      {f.options.length > 0 && <div className="truncate text-footnote text-muted-foreground">{f.options.join(", ")}</div>}
                    </div>
                    <Badge variant="secondary">{TYPE_LABEL[f.type] ?? f.type}</Badge>
                    <Button size="icon-sm" variant="destructive-ghost" aria-label={`Remove ${f.label}`} onClick={() => remove(f)}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <form onSubmit={add} className="space-y-4 self-start rounded-card bg-card p-4 shadow-e1 md:p-5">
        <h2 className="text-headline font-semibold text-foreground">Add a field</h2>
        <div className="space-y-1.5">
          <Label htmlFor="f-entity">For</Label>
          <select id="f-entity" className={nativeSelectClass + " w-full"} value={entity} onChange={(e) => setEntity(e.target.value as never)}>
            <option value="contact">Contacts</option><option value="account">Accounts</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="f-label">Label</Label><Input id="f-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Preferred language" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="f-type">Type</Label>
          <select id="f-type" className={nativeSelectClass + " w-full"} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {type === "select" && (
          <div className="space-y-1.5"><Label htmlFor="f-options">Choices (comma separated)</Label><Input id="f-options" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="English, Urdu, Arabic" /></div>
        )}
        <Button type="submit" className="w-full" disabled={busy || !label.trim()}>{busy && <Loader2 className="animate-spin" />} Add field</Button>
      </form>
    </div>
  );
}
