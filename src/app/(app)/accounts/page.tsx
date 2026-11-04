import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return (
    <PlannedPage
      title="Accounts"
      subtitle="Companies, with every contact and opportunity on them."
      phase={2}
      icon={<Building2 />}
      covers={["company records with many contacts", "ownership, assignees and verification date", "suppression and do-not-contact status"]}
    />
  );
}
