import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Assignments" };

export default function Page() {
  return (
    <PlannedPage
      title="Assignments"
      subtitle="Work given to the team, with evidence and approval."
      phase={4}
      icon={<ClipboardCheck />}
      covers={["assign records and batches", "required evidence before submission", "approve, reject or return with comments"]}
    />
  );
}
