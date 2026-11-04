import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return (
    <PlannedPage
      title="Contacts"
      subtitle="People you sell to, linked to their accounts."
      phase={2}
      icon={<Users />}
      covers={["separate contact and account records", "filters, saved views and bulk actions", "unified timeline per contact"]}
    />
  );
}
