import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewBatchForm } from "@/components/tasks/new-batch-form";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "New assignment" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireUser();
  if (!can(me.role, "assignments.manage")) redirect("/tasks");
  const members = await withScope(me.scope, (tx) =>
    tx.workspaceMember.findMany({ where: { status: "active" }, orderBy: { fullName: "asc" }, select: { userId: true, fullName: true } }),
  );
  return (
    <>
      <PageHeader title="New assignment" subtitle="Give one task to one person, for one or more records." icon={<Plus />} />
      <Card>
        <CardContent className="pt-6">
          <NewBatchForm members={members} />
        </CardContent>
      </Card>
    </>
  );
}
