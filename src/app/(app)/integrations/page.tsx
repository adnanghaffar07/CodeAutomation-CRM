import type { Metadata } from "next";
import { Plug } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return (
    <PlannedPage
      title="Integrations"
      subtitle="Instantly, RingCentral, LinkedIn, email, calendar and Salesforce."
      phase={8}
      icon={<Plug />}
      covers={["connector framework with an error queue", "sync status and last successful sync", "credentials stored encrypted on the server"]}
    />
  );
}
