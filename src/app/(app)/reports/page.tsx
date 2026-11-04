import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <PlannedPage
      title="Reports"
      subtitle="Performance and conversion reporting."
      phase={6}
      icon={<BarChart3 />}
      covers={["employee performance with date and team filters", "activity, quality and outcomes kept separate", "drill-down from every number to its records"]}
    />
  );
}
