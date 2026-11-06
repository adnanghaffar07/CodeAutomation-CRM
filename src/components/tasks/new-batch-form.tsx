"use client";
// Create one assignment for a set of records: the task, the person, the deadline, and the records to include.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, INPUT_CLASS, Textarea, nativeSelectClass } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createAssignmentBatch, searchRecordsForAssignment } from "@/app/(app)/tasks/actions";
import { PRIORITIES, PRIORITY_LABEL, RECURRENCES, RECURRENCE_LABEL, TASK_LABEL, TASK_TYPES } from "@/lib/assignments";

type Member = { userId: string; fullName: string };
type Picked = { id: string; name: string; detail: string | null };

export function NewBatchForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState<(typeof TASK_TYPES)[number]>("research");
  const [recordType, setRecordType] = React.useState<"contact" | "account">("contact");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [priority, setPriority] = React.useState<(typeof PRIORITIES)[number]>("normal");
  const [recurrence, setRecurrence] = React.useState<(typeof RECURRENCES)[number]>("none");
  const [targetCount, setTargetCount] = React.useState("");
  const [requiresEvidence, setRequiresEvidence] = React.useState(true);
  const [instructions, setInstructions] = React.useState("");
  const [criteria, setCriteria] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Picked[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Search as the user types (short pause first), for the chosen record type.
  React.useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchRecordsForAssignment({ recordType, query });
      if (cancelled) return;
      setSearching(false);
      setResults(r.ok ? r.items : []);
      if (!r.ok) toast.error(r.error);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [recordType, query]);

  function changeRecordType(next: "contact" | "account") {
    setRecordType(next);
    setPicked([]);
    setQuery("");
  }

  function add(item: Picked) {
    setPicked((p) => (p.some((x) => x.id === item.id) ? p : [...p, item]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigneeId) return toast.error("Choose who this is for.");
    if (picked.length === 0) return toast.error("Pick at least one record.");
    setBusy(true);
    const r = await createAssignmentBatch({
      title, recordType, taskType, instructions, completionCriteria: criteria, priority, requiresEvidence,
      dueDate: dueDate || null, recurrence, targetCount: targetCount ? Number(targetCount) : null, assigneeId,
      recordIds: picked.map((p) => p.id),
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Assigned ${r.count} ${r.count === 1 ? "record" : "records"}.`);
    router.push(`/tasks/batch/${r.id}`);
  }

  const pickedIds = new Set(picked.map((p) => p.id));
  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="as-title">Title</Label>
          <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Research 20 fintech companies" maxLength={160} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="as-type">Task type</Label>
            <select id="as-type" className={nativeSelectClass} value={taskType} onChange={(e) => setTaskType(e.target.value as typeof taskType)}>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-assignee">Assigned to</Label>
            <select id="as-assignee" className={nativeSelectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
              <option value="">Choose a person</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-due">Due date</Label>
            <Input id="as-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-priority">Priority</Label>
            <select id="as-priority" className={nativeSelectClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-repeat">Repeats</Label>
            <select id="as-repeat" className={nativeSelectClass} value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}>
              {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-target">Target (approved records)</Label>
            <Input id="as-target" type="number" min={1} value={targetCount} onChange={(e) => setTargetCount(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-footnote">
          <Checkbox checked={requiresEvidence} onChange={(e) => setRequiresEvidence(e.target.checked)} />
          Evidence (a note or link) is required before submitting
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="as-instructions">Instructions</Label>
          <Textarea id="as-instructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} placeholder="What to do, and any sources to use" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="as-criteria">Completion criteria</Label>
          <Textarea id="as-criteria" rows={2} value={criteria} onChange={(e) => setCriteria(e.target.value)} maxLength={2000} placeholder="When is this done? For example: owner, email and industry filled in" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="as-kind">Records</Label>
          <select id="as-kind" className={nativeSelectClass} value={recordType} onChange={(e) => changeRecordType(e.target.value as "contact" | "account")}>
            <option value="contact">Contacts</option>
            <option value="account">Companies</option>
          </select>
          <p className="text-caption text-muted-foreground">One assignment uses one kind of record. Changing this clears the list.</p>
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search records"
            className={`${INPUT_CLASS} pl-9`}
            placeholder={recordType === "contact" ? "Search contacts by name or email" : "Search companies by name or domain"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-card-inner bg-muted p-2" aria-busy={searching}>
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-footnote text-muted-foreground">{searching ? "Searching…" : "No matches. Try another search."}</p>
          ) : (
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-control px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-footnote font-medium">{r.name}</div>
                    {r.detail && <div className="truncate text-caption text-muted-foreground">{r.detail}</div>}
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={pickedIds.has(r.id)} onClick={() => add(r)}>
                    {pickedIds.has(r.id) ? "Added" : "Add"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 text-footnote text-muted-foreground">{picked.length} selected</div>
          {picked.length > 0 && (
            <ul className="divide-y divide-border">
              {picked.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-footnote">{p.name}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "Assigning…" : picked.length ? `Assign ${picked.length} ${picked.length === 1 ? "record" : "records"}` : "Assign records"}</Button>
        </div>
      </div>
    </form>
  );
}
