"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";

import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  downloadImportTemplateCsv,
  downloadImportTemplateJson,
  fetchImportExistingCodes,
  fetchImportLookups,
  getImportLookupCounts,
  getValidImportRows,
  getValidJsonImportRows,
  parseImportCsv,
  parseImportJson,
  toImportPreviewRows,
  validateImportRows,
  validateJsonImportItems,
  type ImportLookupCounts,
} from "@/lib/wardrobe/import";
import {
  useBulkImportJsonWardrobeItemsMutation,
  useBulkImportWardrobeItemsMutation,
  useWardrobeLookups,
} from "@/lib/wardrobe/hooks";
import { cn } from "@/lib/utils";
import {
  CSV_IMPORT_COLUMNS,
  type ImportPreviewRow,
  type JsonBulkImportResult,
  type ValidatedImportRow,
  type ValidatedJsonImportRow,
} from "@/types/wardrobe";

type ImportMode = "csv" | "json";

function displayCell(value: string) {
  return value.trim() ? value : "—";
}

function PreviewTable({
  rows,
  showSyncAction = false,
}: {
  rows: ImportPreviewRow[];
  showSyncAction?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[52px]">Row</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              {showSyncAction && (
                <TableHead className="w-[100px]">Action</TableHead>
              )}
              <TableHead className="min-w-[100px]">Code</TableHead>
              <TableHead className="min-w-[160px]">Name</TableHead>
              <TableHead className="min-w-[120px]">Category</TableHead>
              <TableHead className="min-w-[120px]">Brand</TableHead>
              <TableHead className="min-w-[220px]">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.rowNumber}
                className={cn(!row.isValid && "bg-destructive/5")}
              >
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.rowNumber}
                </TableCell>
                <TableCell>
                  {row.isValid ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2Icon className="size-3" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircleIcon className="size-3" />
                      Invalid
                    </Badge>
                  )}
                </TableCell>
                {showSyncAction && (
                  <TableCell>
                    {row.syncAction === "update" ? (
                      <Badge variant="outline">Update</Badge>
                    ) : row.syncAction === "insert" ? (
                      <Badge variant="secondary">Insert</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs">
                  {displayCell(row.code)}
                </TableCell>
                <TableCell>{displayCell(row.name)}</TableCell>
                <TableCell>{displayCell(row.category)}</TableCell>
                <TableCell>{displayCell(row.brand)}</TableCell>
                <TableCell>
                  {row.errors.length > 0 ? (
                    <ul className="space-y-1 text-sm text-destructive">
                      {row.errors.map((error) => (
                        <li key={`${row.rowNumber}-${error}`}>{error}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {showSyncAction ? "Ready to sync" : "Ready to import"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ImportPreviewSection({
  previewRows,
  validCount,
  invalidCount,
  isImporting,
  isParsing,
  importLabel,
  onImport,
  showSyncAction = false,
  syncingLabel = "Importing…",
}: {
  previewRows: ImportPreviewRow[];
  validCount: number;
  invalidCount: number;
  isImporting: boolean;
  isParsing: boolean;
  importLabel: string;
  onImport: () => void;
  showSyncAction?: boolean;
  syncingLabel?: string;
}) {
  if (previewRows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">
            {showSyncAction ? "Sync preview" : "Import preview"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {validCount} valid, {invalidCount} invalid out of {previewRows.length}{" "}
            rows
          </p>
        </div>
        <Button
          onClick={onImport}
          disabled={validCount === 0 || isImporting || isParsing}
        >
          {isImporting ? syncingLabel : importLabel}
        </Button>
      </div>
      <PreviewTable rows={previewRows} showSyncAction={showSyncAction} />
    </section>
  );
}

function SyncResultSummary({ result }: { result: JsonBulkImportResult }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sync complete</CardTitle>
        <CardDescription>
          Items are matched by code. Re-importing the same JSON is idempotent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Inserted
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.inserted}
            </p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Updated
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.updated}
            </p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Failed
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.failed.length}
            </p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Skipped
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.skipped}
            </p>
          </div>
        </div>
        {result.failed.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-destructive">
            {result.failed.map((entry) => (
              <li key={entry.code}>
                <span className="font-mono">{entry.code}</span>: {entry.error}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LookupCountsSummary({ counts }: { counts: ImportLookupCounts }) {
  const entries = Object.entries(counts) as [keyof ImportLookupCounts, number][];
  const emptyTables = entries.filter(([, count]) => count === 0).map(([table]) => table);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Lookup tables loaded</CardTitle>
        <CardDescription>
          Fresh counts fetched from Supabase immediately before validation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {emptyTables.length > 0 && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {emptyTables.length === entries.length
              ? "All lookup tables returned 0 rows. This usually means RLS is blocking anon SELECT — validation will fail even when values exist in the database."
              : `These lookup tables returned 0 rows (check RLS policies): ${emptyTables.join(", ")}`}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map(([table, count]) => (
            <div
              key={table}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2",
                count === 0 ? "border-destructive/30 bg-destructive/5" : "bg-muted/20",
              )}
            >
              <dt className="font-mono text-xs text-muted-foreground">{table}</dt>
              <dd className="text-sm font-semibold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function InventoryImportView() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("csv");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [jsonFileError, setJsonFileError] = useState<string | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [csvValidatedRows, setCsvValidatedRows] = useState<ValidatedImportRow[]>(
    [],
  );
  const [jsonValidatedRows, setJsonValidatedRows] = useState<
    ValidatedJsonImportRow[]
  >([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [isParsingJson, setIsParsingJson] = useState(false);
  const [jsonLookupCounts, setJsonLookupCounts] = useState<ImportLookupCounts | null>(
    null,
  );
  const [jsonSyncResult, setJsonSyncResult] = useState<JsonBulkImportResult | null>(
    null,
  );

  const csvLookupsQuery = useWardrobeLookups();
  const csvImportMutation = useBulkImportWardrobeItemsMutation();
  const jsonImportMutation = useBulkImportJsonWardrobeItemsMutation();

  const csvPreviewRows = useMemo(
    () => toImportPreviewRows(csvValidatedRows),
    [csvValidatedRows],
  );
  const jsonPreviewRows = useMemo(
    () => toImportPreviewRows(jsonValidatedRows),
    [jsonValidatedRows],
  );

  const csvValidRows = useMemo(
    () => csvValidatedRows.filter((row) => row.isValid),
    [csvValidatedRows],
  );
  const csvInvalidRows = useMemo(
    () => csvValidatedRows.filter((row) => !row.isValid),
    [csvValidatedRows],
  );
  const jsonValidRows = useMemo(
    () => jsonValidatedRows.filter((row) => row.isValid),
    [jsonValidatedRows],
  );
  const jsonInvalidRows = useMemo(
    () => jsonValidatedRows.filter((row) => !row.isValid),
    [jsonValidatedRows],
  );

  async function handleCsvFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCsvFileError(null);
    setCsvParseError(null);
    setCsvValidatedRows([]);
    setCsvFileName(file?.name ?? null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvFileError("Please upload a .csv file.");
      return;
    }

    if (!csvLookupsQuery.data) {
      setCsvFileError("Lookups are still loading. Try again in a moment.");
      return;
    }

    setIsParsingCsv(true);

    try {
      const content = await file.text();
      const parsed = parseImportCsv(content);

      if (parsed.fileError) {
        setCsvParseError(parsed.fileError);
        return;
      }

      const codesResult = await fetchImportExistingCodes();
      if (codesResult.error) {
        setCsvParseError(codesResult.error.message);
        return;
      }

      const validation = validateImportRows(
        parsed.rows,
        csvLookupsQuery.data,
        codesResult.data ?? [],
      );

      setCsvValidatedRows(validation.rows);
    } catch (error) {
      setCsvParseError(
        error instanceof Error ? error.message : "Failed to read CSV file.",
      );
    } finally {
      setIsParsingCsv(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  }

  async function handleJsonFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setJsonFileError(null);
    setJsonParseError(null);
    setJsonValidatedRows([]);
    setJsonLookupCounts(null);
    setJsonFileName(file?.name ?? null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      setJsonFileError("Please upload a .json file.");
      return;
    }

    setIsParsingJson(true);

    try {
      const content = await file.text();
      const parsed = parseImportJson(content);

      if (parsed.fileError || !parsed.file) {
        setJsonParseError(parsed.fileError ?? "Failed to parse JSON file.");
        return;
      }

      const lookupsResult = await fetchImportLookups();
      if (lookupsResult.error || !lookupsResult.data) {
        setJsonParseError(
          lookupsResult.error?.message ?? "Failed to fetch lookup tables.",
        );
        return;
      }

      setJsonLookupCounts(getImportLookupCounts(lookupsResult.data));

      const codesResult = await fetchImportExistingCodes();
      if (codesResult.error) {
        setJsonParseError(codesResult.error.message);
        return;
      }

      const validation = validateJsonImportItems(
        parsed.file.items,
        lookupsResult.data,
        codesResult.data ?? [],
      );

      setJsonValidatedRows(validation.rows);
      setJsonSyncResult(null);
    } catch (error) {
      setJsonParseError(
        error instanceof Error ? error.message : "Failed to read JSON file.",
      );
    } finally {
      setIsParsingJson(false);
      if (jsonInputRef.current) {
        jsonInputRef.current.value = "";
      }
    }
  }

  async function handleCsvImport() {
    const inputs = getValidImportRows(csvValidatedRows);
    if (inputs.length === 0) {
      return;
    }

    try {
      await csvImportMutation.mutateAsync(inputs);
      setCsvValidatedRows([]);
      setCsvFileName(null);
      setCsvFileError(null);
      setCsvParseError(null);
    } catch {
      // Mutation onError shows toast.
    }
  }

  async function handleJsonImport() {
    const payloads = getValidJsonImportRows(jsonValidatedRows);
    if (payloads.length === 0) {
      return;
    }

    try {
      const result = await jsonImportMutation.mutateAsync({
        payloads,
        skipped: jsonInvalidRows.length,
      });

      setJsonSyncResult(result);

      if (result.failed.length === 0) {
        setJsonValidatedRows([]);
        setJsonLookupCounts(null);
        setJsonFileName(null);
        setJsonFileError(null);
        setJsonParseError(null);
        return;
      }

      const failedByCode = new Map(
        result.failed.map((entry) => [entry.code.toLowerCase(), entry.error]),
      );

      setJsonValidatedRows((current) =>
        current.flatMap((row) => {
          const failureMessage = failedByCode.get(row.code.toLowerCase());
          if (!failureMessage) {
            return [];
          }

          return [
            {
              ...row,
              isValid: false,
              syncAction: null,
              payload: null,
              errors: row.errors.includes(failureMessage)
                ? row.errors
                : [...row.errors, failureMessage],
            },
          ];
        }),
      );
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="/inventory" />}>
              <ArrowLeftIcon />
              Back to Inventory
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/inventory/review" />}>
              Import review
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bulk import</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Import wardrobe items from CSV or JSON. JSON syncs by item code —
              existing codes are updated and relations replaced; new codes are
              inserted.
            </p>
          </div>
        </div>
      </header>

      <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
        <TabsList>
          <TabsTrigger value="csv">CSV import</TabsTrigger>
          <TabsTrigger value="json">JSON import</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" onClick={downloadImportTemplateCsv}>
              <DownloadIcon />
              Download CSV template
            </Button>
          </div>

          {csvLookupsQuery.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : csvLookupsQuery.error ? (
            <InventoryErrorState
              message={csvLookupsQuery.error.message}
              onRetry={() => csvLookupsQuery.refetch()}
              isRetrying={csvLookupsQuery.isFetching}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Required CSV columns</CardTitle>
                  <CardDescription>
                    Include these headers in the first row. Enum values use snake_case.
                    Lookup values must match names in your database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {CSV_IMPORT_COLUMNS.map((column) => (
                      <Badge key={column} variant="outline" className="font-mono text-xs">
                        {column}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-foreground">Required:</span>{" "}
                      code, name
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Validated:</span>{" "}
                      category, subcategory, brand, primary_color, enums
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV</CardTitle>
                  <CardDescription>
                    Parse and preview rows before importing wardrobe_items only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-xl border border-dashed p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                        <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {csvFileName ?? "Choose a CSV file to preview"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Client-side parsing with row-level validation.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isParsingCsv || csvImportMutation.isPending}
                      onClick={() => csvInputRef.current?.click()}
                    >
                      <UploadIcon />
                      {isParsingCsv ? "Parsing…" : "Select CSV"}
                    </Button>
                  </div>

                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={handleCsvFileSelect}
                  />

                  {(csvFileError || csvParseError) && (
                    <p className="text-sm text-destructive" role="alert">
                      {csvFileError ?? csvParseError}
                    </p>
                  )}
                </CardContent>
              </Card>

              <ImportPreviewSection
                previewRows={csvPreviewRows}
                validCount={csvValidRows.length}
                invalidCount={csvInvalidRows.length}
                isImporting={csvImportMutation.isPending}
                isParsing={isParsingCsv}
                importLabel={`Import ${csvValidRows.length} valid row${csvValidRows.length === 1 ? "" : "s"}`}
                onImport={handleCsvImport}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="json" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" onClick={downloadImportTemplateJson}>
              <DownloadIcon />
              Download JSON template
            </Button>
          </div>

          <>
            <Card>
              <CardHeader>
                <CardTitle>JSON structure</CardTitle>
                <CardDescription>
                  Root object with version, import_type, and items array. Each item
                  is synced by code — updates replace all related metadata.
                  Lookup tables are fetched fresh from Supabase on every upload.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    "version",
                    "import_type",
                    "items[]",
                    "materials[]",
                    "seasons[]",
                    "styles[]",
                    "features[]",
                    "tags[]",
                    "occasions[]",
                    "care",
                  ].map((field) => (
                    <Badge key={field} variant="outline" className="font-mono text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Required:</span>{" "}
                    code, name, category, subcategory, brand, primary_color
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Relations:</span>{" "}
                    item_materials, item_seasons, item_styles, item_features,
                    item_tags, item_occasions, care_profiles
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload JSON</CardTitle>
                <CardDescription>
                  Validates lookup names against a fresh Supabase fetch, then syncs
                  each valid item and its relationships by code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 rounded-xl border border-dashed p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                      <FileJsonIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">
                        {jsonFileName ?? "Choose a JSON file to preview"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Fetches lookup tables, shows counts, then validates rows.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isParsingJson || jsonImportMutation.isPending}
                    onClick={() => jsonInputRef.current?.click()}
                  >
                    <UploadIcon />
                    {isParsingJson ? "Loading lookups…" : "Select JSON"}
                  </Button>
                </div>

                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={handleJsonFileSelect}
                />

                {(jsonFileError || jsonParseError) && (
                  <p className="text-sm text-destructive" role="alert">
                    {jsonFileError ?? jsonParseError}
                  </p>
                )}
              </CardContent>
            </Card>

            {jsonLookupCounts && <LookupCountsSummary counts={jsonLookupCounts} />}

            {jsonSyncResult && <SyncResultSummary result={jsonSyncResult} />}

            <ImportPreviewSection
              previewRows={jsonPreviewRows}
              validCount={jsonValidRows.length}
              invalidCount={jsonInvalidRows.length}
              isImporting={jsonImportMutation.isPending}
              isParsing={isParsingJson}
              importLabel={`Sync ${jsonValidRows.length} valid item${jsonValidRows.length === 1 ? "" : "s"}`}
              syncingLabel="Syncing…"
              showSyncAction
              onImport={handleJsonImport}
            />
          </>
        </TabsContent>
      </Tabs>
    </div>
  );
}
