import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <PlannedPage
      title="Settings"
      subtitle="Users, roles, workspace and preferences."
      phase={1}
      icon={<Settings />}
      covers={["users, roles and suspension", "workspace settings", "integration credentials for authorized users only"]}
    />
  );
}
