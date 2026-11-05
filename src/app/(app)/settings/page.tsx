import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, KeyRound, ScrollText, Settings, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { can, type Capability } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS: { href: string; title: string; hint: string; icon: React.ReactNode; cap: Capability }[] = [
  { href: "/settings/users", title: "Users", hint: "Invite people, set roles, suspend access.", icon: <Users />, cap: "users.read" },
  { href: "/settings/audit", title: "Audit log", hint: "Who did what, and when.", icon: <ScrollText />, cap: "audit.read" },
  { href: "/settings/credentials", title: "Integration credentials", hint: "API keys for Instantly, RingCentral, Salesforce and more, stored encrypted.", icon: <KeyRound />, cap: "integrations.manage" },
];

export default async function SettingsPage() {
  const me = await requireUser();
  const items = SECTIONS.filter((s) => can(me.role, s.cap));
  return (
    <>
      <PageHeader title="Settings" subtitle={`Workspace: ${me.workspaceName}`} icon={<Settings />} />
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="surface-interactive group flex items-center gap-3 rounded-card bg-card p-4 shadow-e1">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-tint text-brand-text [&_svg]:size-5">{s.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline font-semibold text-foreground">{s.title}</span>
                <span className="block text-footnote text-muted-foreground">{s.hint}</span>
              </span>
              <ChevronRight className="size-4 text-tertiary transition-transform duration-fast group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
