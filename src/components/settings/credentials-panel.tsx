"use client";
// Add, replace and delete integration credentials. The browser never receives a saved secret back:
// only the provider, label and the last 4 characters.

import * as React from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { PROVIDERS, PROVIDER_LABEL, type Provider } from "@/lib/providers";
import { deleteCredential, saveCredential } from "@/app/(app)/settings/credentials/actions";

export type CredentialRow = { id: string; provider: Provider; label: string; hint: string; updatedAt: string };

export function CredentialsPanel({ rows }: { rows: CredentialRow[] }) {
  const [provider, setProvider] = React.useState<Provider>("instantly");
  const [label, setLabel] = React.useState("default");
  const [secret, setSecret] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await saveCredential({ provider, label, secret });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setSecret("");
    toast.success("Saved (encrypted)");
  }

  async function remove(row: CredentialRow) {
    if (!(await confirmDialog({ title: "Delete this credential?", message: `${PROVIDER_LABEL[row.provider]} (${row.label}) will stop syncing until a new key is saved.`, confirmLabel: "Delete", variant: "destructive" }))) return;
    const r = await deleteCredential(row.id);
    if (!r.ok) toast.error(r.error); else toast.success("Deleted");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        {rows.length === 0 ? (
          <EmptyState icon={<KeyRound />} title="No credentials saved" hint="Add an API key to let an integration connect. Keys are encrypted and never shown again." />
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-card shadow-e1">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-brand-tint text-brand-text"><KeyRound className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{PROVIDER_LABEL[r.provider]} <span className="text-footnote font-normal text-muted-foreground">· {r.label}</span></div>
                  <div className="text-footnote text-muted-foreground">••••{r.hint} · updated {fmt.format(new Date(r.updatedAt))}</div>
                </div>
                <Button size="icon-sm" variant="destructive-ghost" aria-label={`Delete ${PROVIDER_LABEL[r.provider]} credential`} onClick={() => remove(r)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="space-y-4 self-start rounded-card bg-card p-4 shadow-e1 md:p-5">
        <h2 className="text-headline font-semibold text-foreground">Add or replace a key</h2>
        <div className="space-y-1.5">
          <Label htmlFor="cred-provider">Integration</Label>
          <select id="cred-provider" className={nativeSelectClass + " w-full"} value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cred-label">Label</Label>
          <Input id="cred-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <p className="text-caption text-muted-foreground">Same integration and label replaces the saved key.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cred-secret">API key or token</Label>
          <Input id="cred-secret" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy || secret.length < 8 || !label.trim()}>
          {busy && <Loader2 className="animate-spin" />} Save encrypted
        </Button>
      </form>
    </div>
  );
}
