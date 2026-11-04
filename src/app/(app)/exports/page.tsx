import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Exports" };

export default function Page() {
  return (
    <PlannedPage
      title="Exports"
      subtitle="Request, approve and download datasets."
      phase={7}
      icon={<Download />}
      covers={["export requests with purpose and scope", "CEO approval and an exact approved scope", "expiring authenticated download links"]}
    />
  );
}
