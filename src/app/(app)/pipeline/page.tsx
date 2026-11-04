import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Pipeline" };

export default function Page() {
  return (
    <PlannedPage
      title="Pipeline"
      subtitle="Opportunities from qualified to won or lost."
      phase={5}
      icon={<Kanban />}
      covers={["configurable stages with Kanban and table views", "deal value, owner and expected close", "stage history and stale-opportunity alerts"]}
    />
  );
}
