// Placeholder body for a section whose phase has not been built yet. Every
// section already has its route, title and nav entry (Phase 0), so later phases
// only replace the page contents.

import * as React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function PlannedPage({
  title, subtitle, phase, icon, covers,
}: { title: string; subtitle: string; phase: number; icon: React.ReactNode; covers: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      <Card>
        <CardHeader>
          <CardTitle>Planned for Phase {phase}</CardTitle>
          <CardDescription>This section is wired into the app shell and waiting for its phase.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={icon}
            title="Not built yet"
            hint={`What Phase ${phase} adds: ${covers.join("; ")}.`}
          />
        </CardContent>
      </Card>
    </>
  );
}
