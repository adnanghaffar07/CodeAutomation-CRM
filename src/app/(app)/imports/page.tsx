import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { PlannedPage } from "@/components/shell/planned-page";

export const metadata: Metadata = { title: "Imports" };

export default function Page() {
  return (
    <PlannedPage
      title="Imports"
      subtitle="Bring CSV and Excel data in, safely."
      phase={3}
      icon={<Upload />}
      covers={["column mapping and preview", "duplicate detection that does not leak restricted data", "accepted, rejected and duplicate counts with error reports"]}
    />
  );
}
