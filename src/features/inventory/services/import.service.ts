import {
  selectImportExistingCodes,
  selectImportLookups,
} from "@/features/inventory/repositories/import.repository";
import type {
  CreateWardrobeItemInput,
  CsvImportColumn,
  FitType,
  FormalityEnum,
  ImportPreviewRow,
  ImportValidationResult,
  ItemStatus,
  JsonImportCareInput,
  JsonImportFile,
  JsonImportItemInput,
  JsonImportOccasionInput,
  JsonImportPayload,
  JsonImportValidationResult,
  JsonSyncAction,
  OwnershipType,
  UsageFrequency,
  ValidatedImportRow,
  ValidatedJsonImportRow,
  WardrobeImportLookups,
  WardrobeLookups,
} from "@/features/inventory/types";
import {
  CSV_IMPORT_COLUMNS,
  FIT_TYPES,
  FORMALITY_LEVELS,
  ITEM_STATUSES,
  OWNERSHIP_TYPES,
  USAGE_FREQUENCIES,
} from "@/types/wardrobe";

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEnumKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): { value: T | null; error: string | null } {
  const trimmed = emptyToNull(value);
  if (!trimmed) {
    return { value: null, error: null };
  }

  const normalized = normalizeEnumKey(trimmed);
  const match = allowed.find((option) => option === normalized);

  if (!match) {
    return {
      value: null,
      error: `${label} must be one of: ${allowed.join(", ")}`,
    };
  }

  return { value: match, error: null };
}

function resolveLookupId(
  value: string,
  options: { id: string; name: string }[],
  label: string,
): { id: string | null; error: string | null } {
  const trimmed = emptyToNull(value);
  if (!trimmed) {
    return { id: null, error: null };
  }

  const key = normalizeLookupKey(trimmed);
  const match = options.find(
    (option) => normalizeLookupKey(option.name) === key,
  );

  if (!match) {
    return {
      id: null,
      error: `${label} "${trimmed}" was not found`,
    };
  }

  return { id: match.id, error: null };
}

function resolveRequiredLookupId(
  value: unknown,
  options: { id: string; name: string }[],
  label: string,
): { id: string | null; display: string; error: string | null } {
  if (typeof value !== "string" || !value.trim()) {
    return { id: null, display: "", error: `${label} is required.` };
  }

  const result = resolveLookupId(value, options, label);
  return {
    id: result.id,
    display: value.trim(),
    error: result.error ?? (result.id ? null : `${label} is required.`),
  };
}

function resolveLookupNameList(
  values: unknown,
  options: { id: string; name: string }[],
  label: string,
): { ids: string[]; errors: string[] } {
  if (values === undefined || values === null) {
    return { ids: [], errors: [] };
  }

  if (!Array.isArray(values)) {
    return { ids: [], errors: [`${label} must be an array.`] };
  }

  const ids: string[] = [];
  const errors: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${label} entries must be non-empty strings.`);
      continue;
    }

    const result = resolveLookupId(value, options, label);
    if (result.error) {
      errors.push(result.error);
    } else if (result.id) {
      ids.push(result.id);
    }
  }

  return { ids, errors };
}

function resolveOccasionList(
  values: unknown,
  options: { id: string; name: string }[],
): { rows: { occasion_id: string; score: number | null }[]; errors: string[] } {
  if (values === undefined || values === null) {
    return { rows: [], errors: [] };
  }

  if (!Array.isArray(values)) {
    return { rows: [], errors: ["Occasions must be an array."] };
  }

  const rows: { occasion_id: string; score: number | null }[] = [];
  const errors: string[] = [];

  for (const value of values) {
    if (typeof value !== "object" || value === null) {
      errors.push("Each occasion must be an object with name and optional score.");
      continue;
    }

    const occasion = value as JsonImportOccasionInput;
    if (typeof occasion.name !== "string" || !occasion.name.trim()) {
      errors.push("Occasion name is required.");
      continue;
    }

    const lookup = resolveLookupId(occasion.name, options, "Occasion");
    if (lookup.error) {
      errors.push(lookup.error);
      continue;
    }

    if (!lookup.id) {
      continue;
    }

    let score: number | null = null;
    if (occasion.score !== undefined && occasion.score !== null) {
      const parsedScore = Number(occasion.score);
      if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
        errors.push(`Occasion score for "${occasion.name}" must be between 0 and 10.`);
        continue;
      }
      score = parsedScore;
    }

    rows.push({ occasion_id: lookup.id, score });
  }

  return { rows, errors };
}

function resolveCareProfile(
  care: unknown,
  storageTypes: { id: string; name: string }[],
): {
  care: JsonImportPayload["care"];
  errors: string[];
} {
  if (care === undefined || care === null) {
    return { care: null, errors: [] };
  }

  if (typeof care !== "object") {
    return { care: null, errors: ["Care must be an object."] };
  }

  const careInput = care as JsonImportCareInput;
  const errors: string[] = [];
  let storageTypeId: string | null = null;

  if (careInput.storage !== undefined && careInput.storage !== null) {
    if (typeof careInput.storage !== "string" || !careInput.storage.trim()) {
      errors.push("Care storage must be a non-empty string when provided.");
    } else {
      const storageResult = resolveLookupId(
        careInput.storage,
        storageTypes,
        "Storage type",
      );
      if (storageResult.error) {
        errors.push(storageResult.error);
      } else {
        storageTypeId = storageResult.id;
      }
    }
  }

  const wash =
    typeof careInput.wash === "string" && careInput.wash.trim()
      ? careInput.wash.trim()
      : null;
  const notes =
    typeof careInput.notes === "string" && careInput.notes.trim()
      ? careInput.notes.trim()
      : null;

  if (errors.length > 0) {
    return { care: null, errors };
  }

  return {
    care: {
      storage_type_id: storageTypeId,
      storage:
        typeof careInput.storage === "string" ? careInput.storage.trim() : null,
      wash,
      notes,
    },
    errors: [],
  };
}

export function buildImportTemplateCsv(): string {
  const header = CSV_IMPORT_COLUMNS.join(",");
  const example = [
    "TOP-001",
    "White Oxford Shirt",
    "Tops",
    "Shirts",
    "Uniqlo",
    "White",
    "active",
    "owned",
    "regular",
    "business_casual",
    "8.5",
    "frequent",
    "Classic wardrobe staple",
  ]
    .map((value) => `"${value}"`)
    .join(",");

  return `${header}\n${example}\n`;
}

export function downloadImportTemplateCsv() {
  const content = buildImportTemplateCsv();
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wardrobe-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseImportCsv(content: string): {
  rows: Record<CsvImportColumn, string>[];
  fileError: string | null;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return { rows: [], fileError: "CSV file is empty." };
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      fileError: "CSV must include a header row and at least one data row.",
    };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missingColumns = CSV_IMPORT_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    return {
      rows: [],
      fileError: `Missing required columns: ${missingColumns.join(", ")}`,
    };
  }

  const rows: Record<CsvImportColumn, string>[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const row = {} as Record<CsvImportColumn, string>;

    for (const column of CSV_IMPORT_COLUMNS) {
      const columnIndex = headers.indexOf(column);
      row[column] = columnIndex >= 0 ? (values[columnIndex] ?? "").trim() : "";
    }

    const hasContent = CSV_IMPORT_COLUMNS.some((column) => row[column].length > 0);
    if (hasContent) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { rows: [], fileError: "No data rows found in CSV." };
  }

  return { rows, fileError: null };
}

function validateImportRow(
  rowNumber: number,
  raw: Record<CsvImportColumn, string>,
  lookups: WardrobeLookups,
  existingCodes: Set<string>,
  seenCodes: Set<string>,
): ValidatedImportRow {
  const errors: string[] = [];

  const code = raw.code.trim();
  const name = raw.name.trim();

  if (!code) {
    errors.push("Code is required.");
  } else {
    const normalizedCode = code.toLowerCase();
    if (seenCodes.has(normalizedCode)) {
      errors.push("Duplicate code in CSV.");
    }
    if (existingCodes.has(normalizedCode)) {
      errors.push("Code already exists in inventory.");
    }
    seenCodes.add(normalizedCode);
  }

  if (!name) {
    errors.push("Name is required.");
  }

  const categoryResult = resolveLookupId(raw.category, lookups.categories, "Category");
  if (categoryResult.error) {
    errors.push(categoryResult.error);
  }

  const brandResult = resolveLookupId(raw.brand, lookups.brands, "Brand");
  if (brandResult.error) {
    errors.push(brandResult.error);
  }

  const colorResult = resolveLookupId(
    raw.primary_color,
    lookups.colors,
    "Primary color",
  );
  if (colorResult.error) {
    errors.push(colorResult.error);
  }

  let subcategoryId: string | null = null;
  const subcategoryValue = emptyToNull(raw.subcategory);

  if (subcategoryValue) {
    const subcategoryKey = normalizeLookupKey(subcategoryValue);
    const subcategory = lookups.subcategories.find(
      (option) => normalizeLookupKey(option.name) === subcategoryKey,
    );

    if (!subcategory) {
      errors.push(`Subcategory "${subcategoryValue}" was not found in subcategories.`);
    } else if (categoryResult.id && subcategory.category_id !== categoryResult.id) {
      errors.push("Subcategory does not belong to the selected category.");
    } else if (!categoryResult.id && subcategory.category_id) {
      errors.push("Subcategory requires a valid category.");
    } else {
      subcategoryId = subcategory.id;
    }
  }

  const statusResult = resolveEnumValue<ItemStatus>(
    raw.status,
    ITEM_STATUSES,
    "Status",
  );
  if (statusResult.error) {
    errors.push(statusResult.error);
  }

  const ownershipResult = resolveEnumValue<OwnershipType>(
    raw.ownership,
    OWNERSHIP_TYPES,
    "Ownership",
  );
  if (ownershipResult.error) {
    errors.push(ownershipResult.error);
  }

  const fitResult = resolveEnumValue<FitType>(raw.fit, FIT_TYPES, "Fit");
  if (fitResult.error) {
    errors.push(fitResult.error);
  }

  const formalityResult = resolveEnumValue<FormalityEnum>(
    raw.formality,
    FORMALITY_LEVELS,
    "Formality",
  );
  if (formalityResult.error) {
    errors.push(formalityResult.error);
  }

  const usageResult = resolveEnumValue<UsageFrequency>(
    raw.usage,
    USAGE_FREQUENCIES,
    "Usage",
  );
  if (usageResult.error) {
    errors.push(usageResult.error);
  }

  let rating: number | null = null;
  const ratingValue = emptyToNull(raw.rating);
  if (ratingValue) {
    const parsedRating = Number(ratingValue);
    if (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10) {
      errors.push("Rating must be a number between 0 and 10.");
    } else {
      rating = parsedRating;
    }
  }

  const input: CreateWardrobeItemInput | null =
    errors.length === 0 && code && name
      ? {
          code,
          name,
          category_id: categoryResult.id,
          subcategory_id: subcategoryId,
          brand_id: brandResult.id,
          primary_color_id: colorResult.id,
          status: statusResult.value,
          ownership: ownershipResult.value,
          fit: fitResult.value,
          formality: formalityResult.value,
          rating,
          usage: usageResult.value,
          notes: emptyToNull(raw.notes),
        }
      : null;

  return {
    rowNumber,
    raw,
    input,
    errors,
    isValid: errors.length === 0 && input !== null,
  };
}

export function validateImportRows(
  rows: Record<CsvImportColumn, string>[],
  lookups: WardrobeLookups,
  existingCodes: string[],
): ImportValidationResult {
  const existingCodeSet = new Set(existingCodes.map((code) => code.toLowerCase()));
  const seenCodes = new Set<string>();

  const validatedRows = rows.map((row, index) =>
    validateImportRow(index + 2, row, lookups, existingCodeSet, seenCodes),
  );

  return {
    rows: validatedRows,
    fileError: null,
  };
}

export function getValidImportRows(rows: ValidatedImportRow[]): CreateWardrobeItemInput[] {
  return rows
    .filter((row): row is ValidatedImportRow & { input: CreateWardrobeItemInput } =>
      row.isValid && row.input !== null,
    )
    .map((row) => row.input);
}

export function toImportPreviewRows(
  rows: ValidatedImportRow[] | ValidatedJsonImportRow[],
): ImportPreviewRow[] {
  return rows.map((row) => {
    if ("raw" in row) {
      return {
        rowNumber: row.rowNumber,
        code: row.raw.code,
        name: row.raw.name,
        category: row.raw.category,
        brand: row.raw.brand,
        errors: row.errors,
        isValid: row.isValid,
      };
    }

    return {
      rowNumber: row.rowNumber,
      code: row.code,
      name: row.name,
      category: row.category,
      brand: row.brand,
      errors: row.errors,
      isValid: row.isValid,
      syncAction: row.syncAction,
    };
  });
}

export function buildImportTemplateJson(): string {
  const template: JsonImportFile = {
    version: "1.0",
    import_type: "wardrobe_items",
    items: [
      {
        code: "TOP-001",
        name: "White Oxford Shirt",
        category: "Tops",
        subcategory: "Shirts",
        brand: "Uniqlo",
        primary_color: "White",
        status: "active",
        ownership: "owned",
        fit: "regular",
        formality: "business_casual",
        rating: 8.5,
        usage: "frequent",
        notes: "Classic wardrobe staple",
        materials: ["Cotton"],
        seasons: ["Spring", "Summer"],
        styles: ["Classic"],
        features: ["Breathable"],
        tags: ["work"],
        occasions: [{ name: "Office", score: 9 }],
        care: {
          storage: "Hanger",
          wash: "Cold wash, hang dry",
          notes: "Iron on low heat",
        },
      },
    ],
  };

  return `${JSON.stringify(template, null, 2)}\n`;
}

export function downloadImportTemplateJson() {
  const content = buildImportTemplateJson();
  const blob = new Blob([content], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wardrobe-import-template.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function isJsonImportItem(value: unknown): value is JsonImportItemInput {
  return typeof value === "object" && value !== null;
}

export function parseImportJson(content: string): {
  file: JsonImportFile | null;
  fileError: string | null;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return { file: null, fileError: "JSON file is empty." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { file: null, fileError: "Invalid JSON format." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { file: null, fileError: "JSON root must be an object." };
  }

  const root = parsed as Partial<JsonImportFile>;

  if (typeof root.version !== "string" || !root.version.trim()) {
    return { file: null, fileError: 'JSON must include a "version" string.' };
  }

  if (typeof root.import_type !== "string" || !root.import_type.trim()) {
    return { file: null, fileError: 'JSON must include an "import_type" string.' };
  }

  if (!Array.isArray(root.items)) {
    return { file: null, fileError: 'JSON must include an "items" array.' };
  }

  if (root.items.length === 0) {
    return { file: null, fileError: "JSON items array is empty." };
  }

  const items = root.items.filter(isJsonImportItem) as JsonImportItemInput[];

  if (items.length !== root.items.length) {
    return { file: null, fileError: "Each entry in items must be an object." };
  }

  return {
    file: {
      version: root.version,
      import_type: root.import_type,
      items,
    },
    fileError: null,
  };
}

function validateJsonImportItem(
  rowNumber: number,
  raw: JsonImportItemInput,
  lookups: WardrobeImportLookups,
  existingCodes: Set<string>,
  seenCodes: Set<string>,
): ValidatedJsonImportRow {
  const errors: string[] = [];

  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  if (!code) {
    errors.push("Code is required.");
  } else {
    const normalizedCode = code.toLowerCase();
    if (seenCodes.has(normalizedCode)) {
      errors.push("Duplicate code in JSON file.");
    } else {
      seenCodes.add(normalizedCode);
    }
  }

  if (!name) {
    errors.push("Name is required.");
  }

  const categoryResult = resolveRequiredLookupId(
    raw.category,
    lookups.categories,
    "Category",
  );
  if (categoryResult.error) {
    errors.push(categoryResult.error);
  }

  const subcategoryResult = resolveRequiredLookupId(
    raw.subcategory,
    lookups.subcategories,
    "Subcategory",
  );
  if (subcategoryResult.error) {
    errors.push(subcategoryResult.error);
  } else if (
    subcategoryResult.id &&
    categoryResult.id &&
    !lookups.subcategories.some(
      (subcategory) =>
        subcategory.id === subcategoryResult.id &&
        subcategory.category_id === categoryResult.id,
    )
  ) {
    errors.push("Subcategory does not belong to the selected category.");
  }

  const brandResult = resolveRequiredLookupId(raw.brand, lookups.brands, "Brand");
  if (brandResult.error) {
    errors.push(brandResult.error);
  }

  const colorResult = resolveRequiredLookupId(
    raw.primary_color,
    lookups.colors,
    "Primary color",
  );
  if (colorResult.error) {
    errors.push(colorResult.error);
  }

  const statusResult = resolveEnumValue<ItemStatus>(
    typeof raw.status === "string" ? raw.status : "",
    ITEM_STATUSES,
    "Status",
  );
  if (statusResult.error) {
    errors.push(statusResult.error);
  }

  const ownershipResult = resolveEnumValue<OwnershipType>(
    typeof raw.ownership === "string" ? raw.ownership : "",
    OWNERSHIP_TYPES,
    "Ownership",
  );
  if (ownershipResult.error) {
    errors.push(ownershipResult.error);
  }

  const fitResult = resolveEnumValue<FitType>(
    typeof raw.fit === "string" ? raw.fit : "",
    FIT_TYPES,
    "Fit",
  );
  if (fitResult.error) {
    errors.push(fitResult.error);
  }

  const formalityResult = resolveEnumValue<FormalityEnum>(
    typeof raw.formality === "string" ? raw.formality : "",
    FORMALITY_LEVELS,
    "Formality",
  );
  if (formalityResult.error) {
    errors.push(formalityResult.error);
  }

  const usageResult = resolveEnumValue<UsageFrequency>(
    typeof raw.usage === "string" ? raw.usage : "",
    USAGE_FREQUENCIES,
    "Usage",
  );
  if (usageResult.error) {
    errors.push(usageResult.error);
  }

  let rating: number | null = null;
  if (raw.rating !== undefined && raw.rating !== null) {
    const parsedRating = Number(raw.rating);
    if (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10) {
      errors.push("Rating must be a number between 0 and 10.");
    } else {
      rating = parsedRating;
    }
  }

  const materialsResult = resolveLookupNameList(
    raw.materials,
    lookups.materials,
    "Material",
  );
  errors.push(...materialsResult.errors);

  const seasonsResult = resolveLookupNameList(raw.seasons, lookups.seasons, "Season");
  errors.push(...seasonsResult.errors);

  const stylesResult = resolveLookupNameList(raw.styles, lookups.styles, "Style");
  errors.push(...stylesResult.errors);

  const featuresResult = resolveLookupNameList(
    raw.features,
    lookups.features,
    "Feature",
  );
  errors.push(...featuresResult.errors);

  const tagsResult = resolveLookupNameList(raw.tags, lookups.tags, "Tag");
  errors.push(...tagsResult.errors);

  const occasionsResult = resolveOccasionList(raw.occasions, lookups.occasions);
  errors.push(...occasionsResult.errors);

  const careResult = resolveCareProfile(raw.care, lookups.storage_types);
  errors.push(...careResult.errors);

  const notes =
    typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null;

  const syncAction: JsonSyncAction | null =
    code && errors.every((message) => !message.includes("Duplicate code"))
      ? existingCodes.has(code.toLowerCase())
        ? "update"
        : "insert"
      : null;

  const payload: JsonImportPayload | null =
    errors.length === 0 &&
    code &&
    name &&
    categoryResult.id &&
    subcategoryResult.id &&
    brandResult.id &&
    colorResult.id
      ? {
          item: {
            code,
            name,
            category_id: categoryResult.id,
            subcategory_id: subcategoryResult.id,
            brand_id: brandResult.id,
            primary_color_id: colorResult.id,
            status: statusResult.value,
            ownership: ownershipResult.value,
            fit: fitResult.value,
            formality: formalityResult.value,
            rating,
            usage: usageResult.value,
            notes,
          },
          materialIds: materialsResult.ids,
          seasonIds: seasonsResult.ids,
          styleIds: stylesResult.ids,
          featureIds: featuresResult.ids,
          tagIds: tagsResult.ids,
          occasions: occasionsResult.rows,
          care: careResult.care,
        }
      : null;

  return {
    rowNumber,
    code,
    name,
    category: categoryResult.display,
    brand: brandResult.display,
    errors,
    isValid: errors.length === 0 && payload !== null,
    syncAction: payload ? syncAction : null,
    payload,
  };
}

export function validateJsonImportItems(
  items: JsonImportItemInput[],
  lookups: WardrobeImportLookups,
  existingCodes: string[],
): JsonImportValidationResult {
  const existingCodeSet = new Set(existingCodes.map((code) => code.toLowerCase()));
  const seenCodes = new Set<string>();

  const rows = items.map((item, index) =>
    validateJsonImportItem(index + 1, item, lookups, existingCodeSet, seenCodes),
  );

  return { rows, fileError: null };
}

export function getValidJsonImportRows(
  rows: ValidatedJsonImportRow[],
): JsonImportPayload[] {
  return rows
    .filter(
      (row): row is ValidatedJsonImportRow & { payload: JsonImportPayload } =>
        row.isValid && row.payload !== null,
    )
    .map((row) => row.payload);
}

export type ImportLookupCounts = {
  categories: number;
  subcategories: number;
  brands: number;
  colors: number;
  materials: number;
  seasons: number;
  styles: number;
  features: number;
  tags: number;
  occasions: number;
  storage_types: number;
};

export function getImportLookupCounts(
  lookups: WardrobeImportLookups,
): ImportLookupCounts {
  return {
    categories: lookups.categories.length,
    subcategories: lookups.subcategories.length,
    brands: lookups.brands.length,
    colors: lookups.colors.length,
    materials: lookups.materials.length,
    seasons: lookups.seasons.length,
    styles: lookups.styles.length,
    features: lookups.features.length,
    tags: lookups.tags.length,
    occasions: lookups.occasions.length,
    storage_types: lookups.storage_types.length,
  };
}

export async function fetchImportLookups(): Promise<{
  data: WardrobeImportLookups | null;
  error: Error | null;
}> {
  return selectImportLookups();
}

export async function fetchImportExistingCodes(): Promise<{
  data: string[] | null;
  error: Error | null;
}> {
  return selectImportExistingCodes();
}

export async function validateUploadedCsvImport(
  content: string,
  lookups: WardrobeLookups,
): Promise<{ data: ValidatedImportRow[] | null; error: Error | null }> {
  const parsed = parseImportCsv(content);

  if (parsed.fileError) {
    return { data: null, error: new Error(parsed.fileError) };
  }

  const codesResult = await fetchImportExistingCodes();
  if (codesResult.error) {
    return { data: null, error: codesResult.error };
  }

  const validation = validateImportRows(
    parsed.rows,
    lookups,
    codesResult.data ?? [],
  );

  return { data: validation.rows, error: null };
}

export async function validateUploadedJsonImport(content: string): Promise<{
  data: {
    rows: ValidatedJsonImportRow[];
    lookupCounts: ImportLookupCounts;
  } | null;
  error: Error | null;
}> {
  const parsed = parseImportJson(content);

  if (parsed.fileError || !parsed.file) {
    return {
      data: null,
      error: new Error(parsed.fileError ?? "Failed to parse JSON file."),
    };
  }

  const lookupsResult = await fetchImportLookups();
  if (lookupsResult.error || !lookupsResult.data) {
    return {
      data: null,
      error: lookupsResult.error ?? new Error("Failed to fetch lookup tables."),
    };
  }

  const codesResult = await fetchImportExistingCodes();
  if (codesResult.error) {
    return { data: null, error: codesResult.error };
  }

  const validation = validateJsonImportItems(
    parsed.file.items,
    lookupsResult.data,
    codesResult.data ?? [],
  );

  return {
    data: {
      rows: validation.rows,
      lookupCounts: getImportLookupCounts(lookupsResult.data),
    },
    error: null,
  };
}
