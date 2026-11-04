import type { Metadata } from "next";
import { Activity, CalendarCheck, ClipboardCheck, LayoutDashboard, Mail, Phone, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Stat, StatGroup } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

// Phase 0 placeholder. Phase 6 builds the CEO dashboard on rollup tables.
// Rule carried over from the reference CRM: every number comes from real records,
// so with none yet each tile says "No data yet" instead of showing a modelled zero.
const TILES = [
  { label: "Leads added", icon: <Users />, accent: "blue" as const },
  { label: "Assignments overdue", icon: <ClipboardCheck />, accent: "amber" as const },
  { label: "Emails sent", icon: <Mail />, accent: "sky" as const },
  { label: "Calls connected", icon: <Phone />, accent: "emerald" as const },
  { label: "Meetings booked", icon: <CalendarCheck />, accent: "violet" as const },
  { label: "Pipeline value", icon: <TrendingUp />, accent: "rose" as const },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Team activity, assignments and pipeline in one place." icon={<LayoutDashboard />} />

      <section className="hero-banner relative mb-6 overflow-hidden rounded-card p-5 text-white md:p-7">
        <p className="text-caption2 font-semibold uppercase tracking-[0.06em] text-white/70">CodeAutomation CRM</p>
        <h2 className="mt-1 text-title2 font-semibold md:text-title1">Foundation is in place</h2>
        <p className="mt-1 max-w-[60ch] text-body text-white/80">
          The app shell, design system and database setup are ready. Sign-in and roles come next in Phase 1.
        </p>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-line-accent" />
      </section>

      <SectionHeader title="Overview" context="Numbers appear once real records exist." />
      <StatGroup>
        {TILES.map((t) => (
          <Stat key={t.label} label={t.label} value="—" hint="No data yet" icon={t.icon} accent={t.accent} isZero />
        ))}
      </StatGroup>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Who did what, when, on which record.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState icon={<Activity />} title="No activity yet" hint="Activity from imports, assignments and integrations will show here." />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
