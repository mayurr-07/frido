import Papa from "papaparse";

/** The full Item Master field set. Unknown columns are preserved in `raw`. */
export const ITEM_MASTER_FIELDS = [
  { key: "categoryCode", label: "Category Code", aliases: ["category code", "category_code", "category"] },
  { key: "productCode", label: "Product Code", aliases: ["product code", "product_code", "sku", "code", "item code"], required: true },
  { key: "name", label: "Name", aliases: ["name", "product name", "product_name", "item name", "title"], required: true },
  { key: "description", label: "Description", aliases: ["description", "desc", "product description"] },
  { key: "scanIdentifier", label: "Scan Identifier", aliases: ["scan identifier", "scan_identifier", "barcode", "ean", "scan id"] },
  { key: "brand", label: "Brand", aliases: ["brand", "brand name"] },
  { key: "color", label: "Color", aliases: ["color", "colour"] },
  { key: "size", label: "Size", aliases: ["size", "variant size"] },
  { key: "lengthCm", label: "Length", aliases: ["length", "length cm", "length_cm"] },
  { key: "widthCm", label: "Width", aliases: ["width", "width cm", "width_cm"] },
  { key: "heightCm", label: "Height", aliases: ["height", "height cm", "height_cm"] },
  { key: "weightG", label: "Weight", aliases: ["weight", "weight g", "weight_g", "weight gm"] },
  { key: "basePrice", label: "Base Price", aliases: ["base price", "base_price"] },
  { key: "costPrice", label: "Cost Price", aliases: ["cost price", "cost_price"] },
  { key: "mrp", label: "MRP", aliases: ["mrp", "price", "retail price", "max retail price"], required: true },
  { key: "enabled", label: "Enabled", aliases: ["enabled", "active", "is enabled"] },
  { key: "type", label: "Type", aliases: ["type", "product type"] },
  { key: "componentProductCode", label: "Component Product Code", aliases: ["component product code", "component_product_code", "component code"] },
  { key: "catalogCategory", label: "Catalog Category Full Name", aliases: ["catalog category full name", "catalog_category_full_name", "catalog category"] },
] as const;

export const REQUIRED_COLUMNS = ITEM_MASTER_FIELDS.filter((f) => "required" in f && f.required).map(
  (f) => f.label
);

export type ParsedProductData = {
  categoryCode: string | null;
  productCode: string;
  name: string;
  description: string | null;
  scanIdentifier: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  weightG: string | null;
  basePrice: number | null;
  costPrice: number | null;
  mrp: number | null;
  enabled: boolean | null;
  type: string | null;
  componentProductCode: string | null;
  catalogCategory: string | null;
};

export type ParsedRow = {
  rowNumber: number;
  data: ParsedProductData;
  raw: Record<string, string>;
  isValid: boolean;
  issues: string[];
  warnings: string[];
};

export type ParsedCsv = {
  filename: string;
  headers: string[];
  detectedFields: string[];
  unknownColumns: string[];
  missingRequiredColumns: string[];
  duplicateProductCodes: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

export class CsvStructureError extends Error {
  missingRequiredColumns: string[];
  constructor(message: string, missingRequiredColumns: string[]) {
    super(message);
    this.missingRequiredColumns = missingRequiredColumns;
  }
}

const normalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const clean = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/^\uFEFF/, "").trim();
  return text.length === 0 ? null : text;
};

function parseMoney(value: string | null): { value: number | null; issue?: string; warning?: string } {
  if (value === null) return { value: null, issue: "Missing MRP" };
  const normalized = value.replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { value: null, issue: `Invalid numeric value "${value}"` };
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, issue: `Invalid numeric value "${value}"` };
  if (parsed <= 0) return { value: null, issue: `Value must be greater than zero ("${value}")` };
  return { value: parsed };
}

function parseOptionalNumber(value: string | null): { value: number | null; warning?: string } {
  if (value === null) return { value: null };
  const normalized = value.replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { value: null, warning: `Non-numeric measurement "${value}" preserved as text` };
  }
  return { value: Number(normalized) };
}

function parseEnabled(value: string | null): boolean | null {
  if (value === null) return null;
  return ["true", "1", "yes", "y", "enabled", "active"].includes(value.toLowerCase());
}

export function parseItemMasterCsv(text: string, filename: string): ParsedCsv {
  const withoutBom = text.replace(/^\uFEFF/, "");

  if (withoutBom.trim().length === 0) {
    throw new CsvStructureError("The uploaded file is empty.", [...REQUIRED_COLUMNS]);
  }

  const result = Papa.parse<Record<string, string>>(withoutBom, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => clean(header) ?? header,
  });

  const headers = (result.meta.fields ?? []).map((h) => String(h));
  if (headers.length === 0) {
    throw new CsvStructureError("No CSV header row could be detected.", [...REQUIRED_COLUMNS]);
  }

  const normalizedToOriginal = new Map<string, string>();
  for (const header of headers) normalizedToOriginal.set(normalizeHeader(header), header);

  const resolved: Record<string, string> = {};
  const detectedFields: string[] = [];
  for (const field of ITEM_MASTER_FIELDS) {
    const original = field.aliases
      .map((alias) => normalizedToOriginal.get(normalizeHeader(alias)))
      .find(Boolean);
    if (original) {
      resolved[field.key] = original;
      detectedFields.push(field.label);
    }
  }

  const missingRequiredColumns = REQUIRED_COLUMNS.filter((label) => {
    const field = ITEM_MASTER_FIELDS.find((f) => f.label === label);
    return !field || !resolved[field.key];
  });
  if (missingRequiredColumns.length > 0) {
    throw new CsvStructureError(
      `Missing required column(s): ${missingRequiredColumns.join(", ")}.`,
      missingRequiredColumns
    );
  }

  const knownOriginals = new Set(Object.values(resolved));
  const unknownColumns = headers.filter((h) => !knownOriginals.has(h));

  const dataRows = result.data.filter((row) =>
    Object.values(row ?? {}).some((v) => typeof v === "string" && v.trim().length > 0)
  );

  if (dataRows.length === 0) {
    throw new CsvStructureError("The CSV contains a header but no product rows.", []);
  }

  const codeCounts = new Map<string, number>();
  for (const row of dataRows) {
    const code = clean(row[resolved.productCode])?.toUpperCase();
    if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  }
  const duplicateProductCodes = Array.from(codeCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  const rows: ParsedRow[] = dataRows.map((rawRow, index) => {
    const get = (key: string): string | null =>
      resolved[key] ? clean(rawRow[resolved[key]]) : null;

    const issues: string[] = [];
    const warnings: string[] = [];

    const productCode = get("productCode");
    const name = get("name");
    if (!productCode) issues.push("Missing Product Code");
    if (!name) issues.push("Missing Product Name");

    const mrp = parseMoney(get("mrp"));
    if (mrp.issue) issues.push(mrp.issue);
    const basePrice = parseOptionalNumber(get("basePrice"));
    const costPrice = parseOptionalNumber(get("costPrice"));
    if (basePrice.warning) warnings.push(`Base Price: ${basePrice.warning}`);
    if (costPrice.warning) warnings.push(`Cost Price: ${costPrice.warning}`);

    if (productCode && (codeCounts.get(productCode.toUpperCase()) ?? 0) > 1) {
      issues.push(`Duplicate Product Code "${productCode}"`);
    }
    const scanIdentifier = get("scanIdentifier");
    if (scanIdentifier && !/^[A-Za-z0-9._-]+$/.test(scanIdentifier)) {
      warnings.push("Scan Identifier contains unusual characters");
    }

    const data: ParsedProductData = {
      categoryCode: get("categoryCode"),
      productCode: productCode ?? "",
      name: name ?? "",
      description: get("description"),
      scanIdentifier,
      brand: get("brand"),
      color: get("color"),
      size: get("size"),
      lengthCm: get("lengthCm"),
      widthCm: get("widthCm"),
      heightCm: get("heightCm"),
      weightG: get("weightG"),
      basePrice: basePrice.value,
      costPrice: costPrice.value,
      mrp: mrp.value,
      enabled: parseEnabled(get("enabled")),
      type: get("type"),
      componentProductCode: get("componentProductCode"),
      catalogCategory: get("catalogCategory"),
    };

    return {
      rowNumber: index + 2,
      data,
      raw: rawRow as Record<string, string>,
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  });

  return {
    filename,
    headers,
    detectedFields,
    unknownColumns,
    missingRequiredColumns: [],
    duplicateProductCodes,
    rows,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.isValid).length,
    invalidRows: rows.filter((r) => !r.isValid).length,
  };
}

export function buildErrorReportCsv(parsed: ParsedCsv): string {
  const invalid = parsed.rows.filter((row) => !row.isValid);
  return Papa.unparse(
    invalid.map((row) => ({
      "Row Number": row.rowNumber,
      "Product Code": row.data.productCode,
      Name: row.data.name,
      "Validation Issues": row.issues.join(" | "),
      Warnings: row.warnings.join(" | "),
      MRP: row.data.mrp ?? "",
      "Raw Row": JSON.stringify(row.raw),
    })),
    { columns: ["Row Number", "Product Code", "Name", "Validation Issues", "Warnings", "MRP", "Raw Row"] }
  );
}

export const SAMPLE_ITEM_MASTER_CSV = `Category Code,Product Code,Name,Description,Scan Identifier,Brand,Color,Size,Length,Width,Height,Weight,Base Price,Cost Price,MRP,Enabled,Type,Component Product Code,Catalog Category Full Name
SIT,FRD-SIT-CX-BLK,Frido Ultimate Ergonomic Coccyx Seat Cushion - Black,Tailbone relief memory foam cushion,8906000010011,Frido,Jet Black,Standard,45,36,8,850,1200,1450,1999,TRUE,Sit,"",Frido > Sit > Cushions
INS,FRD-INS-DG-M,Frido Dual Gel Insoles - Medium (UK 6-8),Dual density shock absorbing gel insoles,8906000010028,Frido,Yellow / Charcoal,Medium,27.5,9.2,1.4,180,320,410,799,TRUE,Walk,,Frido > Walk > Insoles
SLP,FRD-SLP-CRV-STD,Frido Ultimate Cervical Contour Memory Foam Pillow,Orthopedic neck support pillow,8906000010035,Frido,Cloud White / Grey Piping,Standard,60,35,11.5,1100,900,1400,2499,TRUE,Sleep,,Frido > Sleep > Pillows
INS,FRD-INS-DG-M-26,Frido Dual Gel Insoles - Medium (2026 Pack),Seasonal packaging refresh of medium gel insole,8906000010042,Frido,Yellow / Charcoal,Medium,27.5,9.2,1.4,180,320,410,799,TRUE,Walk,,Frido > Walk > Insoles
SIT,FRD-SIT-CX-BLK-26,Frido Ultimate Coccyx Cushion - Obsidian Edition,Seasonal colour variant of coccyx cushion,8906000010059,Frido,Obsidian Black,Standard,45,36,8,850,1200,1450,2099,TRUE,Sit,,Frido > Sit > Cushions
WALK,FRD-WALK-RECOVERY-SLIDE-M,Frido CloudWalk Recovery Slides - Medium,All new EVA recovery footwear,,Frido,Mustard Yellow,Medium,28,11,5.5,300,600,900,1499,TRUE,Footwear,,Frido > Walk > Footwear`;
