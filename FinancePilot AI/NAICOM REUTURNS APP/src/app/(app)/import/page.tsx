import type { Metadata } from "next";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import Excel" };

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Excel</h1>
        <p className="text-sm text-muted-foreground">
          Upload an Income Production / PPS / CRR workbook — read, map, validate, then import the
          valid records into the policy database.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
