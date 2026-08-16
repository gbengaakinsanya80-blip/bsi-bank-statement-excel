"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Field, Select } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  uploadImportAction,
  validateImportAction,
  confirmImportAction,
  type UploadImportResult,
  type ValidateImportResult,
  type ConfirmImportResult,
} from "@/lib/import/import-actions";
import { POLICY_FIELDS } from "@/lib/import/mapping";
import type { ColumnMapping } from "@/lib/import/mapping";
import type { ImportValidationSummary } from "@/lib/import/validation";

type Step = "upload" | "map" | "validate";

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [upload, setUpload] = useState<UploadImportResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [summary, setSummary] = useState<ImportValidationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await uploadImportAction(formData);
      if (!res.ok || !res.sessionId) {
        setError(res.error ?? "Upload failed.");
        setBusy(false);
        return;
      }
      setUpload(res);
      setMapping(res.mappings ?? []);
      setStep("map");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  function setTarget(columnIndex: number, targetKey: string) {
    setMapping((prev) =>
      prev.map((c) => (c.index === columnIndex ? { ...c, targetKey: targetKey || null } : c))
    );
  }

  async function onValidate() {
    if (!upload?.sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const res: ValidateImportResult = await validateImportAction(upload.sessionId, mapping);
      if (!res.ok || !res.summary) {
        setError(res.error ?? "Validation failed.");
        setBusy(false);
        return;
      }
      setSummary(res.summary);
      setStep("validate");
    } catch {
      setError("Something went wrong during validation.");
    }
    setBusy(false);
  }

  async function onImport() {
    if (!upload?.sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const res: ConfirmImportResult = await confirmImportAction(upload.sessionId, mapping);
      if (!res.ok) {
        setError(res.error ?? "Import failed.");
        setBusy(false);
        return;
      }
      alert(
        `Imported ${res.count} valid polic${res.count === 1 ? "y" : "ies"}.` +
          (res.invalid ? ` ${res.invalid} row${res.invalid === 1 ? " was" : "s were"} skipped (invalid).` : "") +
          (res.duplicates ? ` ${res.duplicates} duplicate${res.duplicates === 1 ? "" : "s"} skipped.` : "")
      );
      router.push("/policies");
      router.refresh();
    } catch {
      setError("Something went wrong during import.");
    }
    setBusy(false);
  }

  function reset() {
    setStep("upload");
    setUpload(null);
    setSummary(null);
    setMapping([]);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Upload workbook</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUpload} className="space-y-4">
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv"
                required
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Upload the Income Production / PPS / CRR workbook. Columns are auto-detected and can
                be re-mapped on the next step.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? "Reading…" : "Upload & preview"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "map" && upload && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>2. Map columns</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {upload.fileName} · sheet “{upload.sheetName}” · {upload.totalRows} data rows
                </p>
              </div>
              <Badge variant="secondary">{(upload.headers ?? []).length} columns</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mapping.map((col) => (
                  <Field key={col.index} label={col.sourceHeader || `Column ${col.index + 1}`}>
                    <Select
                      value={col.targetKey ?? ""}
                      onChange={(e) => setTarget(col.index, e.target.value)}
                    >
                      <option value="">— Ignore —</option>
                      {POLICY_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={onValidate} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {busy ? "Validating…" : "Validate rows"}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  Upload another file
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview (first {upload.preview?.length ?? 0} rows)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(upload.headers ?? []).map((h, i) => (
                      <TableHead key={i}>{h || `Col ${i + 1}`}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(upload.preview ?? []).map((row, ri) => (
                    <TableRow key={ri}>
                      {(upload.headers ?? []).map((_, ci) => (
                        <TableCell key={ci}>
                          {row[ci] === null ? "—" : String(row[ci])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {step === "validate" && upload && summary && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle>3. Validation & import</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">Valid: {summary.valid}</Badge>
                <Badge variant="warning">Invalid: {summary.invalid}</Badge>
                <Badge variant="secondary">Duplicates: {summary.duplicates}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={onImport} disabled={busy || summary.valid === 0}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  {busy ? "Importing…" : `Import ${summary.valid} valid record${summary.valid === 1 ? "" : "s"}`}
                </Button>
                <a
                  href={`/api/import/${upload.sessionId}/report`}
                  className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")}
                >
                  Download error report
                </a>
                <Button type="button" variant="ghost" onClick={() => setStep("map")}>
                  Adjust mapping
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Row results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.results.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell>{String(r.record?.policy_number ?? "") || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.duplicate ? "secondary" : r.valid ? "success" : "destructive"}>
                          {r.duplicate ? "Duplicate" : r.valid ? "OK" : "Invalid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        {r.issues.length > 0 ? (
                          <span className="flex items-start gap-1">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {r.issues.join(" ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {summary.results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                        No data rows found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
