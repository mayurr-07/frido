import mammoth from "mammoth";

export type ExtractedSticker = {
  stickerIdentifier: string | null;
  productName: string | null;
  commonName: string | null;
  netQuantity: string | null;
  dimensions: string | null;
  colorVariant: string | null;
  sizeVariant: string | null;
  manufacturingMonthYear: string | null;
  batchNumber: string | null;
  packagedBy: string | null;
  marketedBy: string | null;
  countryOfOrigin: string | null;
  mrp: number | null;
  customerCare: string | null;
  missingFields: string[];
  extractionStatus: "extracted" | "needs_attention" | "conflicted";
  extractionNote: string | null;
  familyKey: string | null;
  rawText: string;
};

const FIELD_LABELS: Array<{ key: keyof ExtractedSticker; labels: string[] }> = [
  { key: "commonName", labels: ["common name", "generic name", "common/generic name"] },
  { key: "productName", labels: ["product name", "name of the product", "article name", "product"] },
  { key: "netQuantity", labels: ["net quantity", "net qty", "quantity", "net content"] },
  { key: "dimensions", labels: ["dimensions", "dimension", "product dimensions", "size (cm)"] },
  // Explicit colour / variant fields only. A product name is never used as colour or size evidence.
  { key: "colorVariant", labels: ["colour", "color", "colour variant", "color variant", "shade", "colour name"] },
  { key: "sizeVariant", labels: ["size variant", "variant size", "size (variant)", "variant"] },
  { key: "manufacturingMonthYear", labels: ["manufacturing month", "mfg month", "date of manufacture", "mfg. date", "manufactured on"] },
  { key: "batchNumber", labels: ["batch number", "batch no", "lot number", "lot no"] },
  { key: "packagedBy", labels: ["packaged by", "packaged & marketed by", "packed by", "packer"] },
  { key: "marketedBy", labels: ["marketed by", "manufactured & marketed by", "mfg & mktd by", "manufactured by", "marketer"] },
  { key: "countryOfOrigin", labels: ["country of origin", "origin", "made in"] },
  { key: "mrp", labels: ["mrp", "maximum retail price", "mrp (incl. of all taxes)", "mrp inclusive of all taxes"] },
  { key: "customerCare", labels: ["customer care", "customer care details", "for customer care", "contact us", "care"] },
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Extracts table cell pairs from mammoth's HTML output: [[label, value], ...] */
export function extractTablePairs(html: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(stripTags).filter(Boolean);
    if (cells.length >= 2) pairs.push([cells[0], cells.slice(1).join(" ")]);
  }
  return pairs;
}

function labelMatch(text: string): { key: keyof ExtractedSticker; value: string } | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (const field of FIELD_LABELS) {
    for (const label of field.labels) {
      if (normalized.startsWith(`${label}:`) || normalized.startsWith(`${label} -`)) {
        const value = text.replace(/^[^:\-]+[:\-]/, "").trim();
        if (value) return { key: field.key, value };
      }
    }
  }
  return null;
}

const MRP_PATTERN = /(?:₹|rs\.?\s*)\s*([\d,]+(?:\.\d{1,2})?)/i;

export function parseMrp(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(MRP_PATTERN) ?? value.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeIdentifier(value: string | null): string | null {
  if (!value) return null;
  const tokens = value.toUpperCase().match(/[A-Z]{2,6}(?:[-_/][A-Z0-9]{1,8}){2,}/g);
  if (!tokens || tokens.length === 0) return null;
  return tokens[0].replace(/[_/]/g, "-");
}

function familyKey(identifier: string | null, productName: string | null): string | null {
  if (identifier) return identifier.split("-").slice(0, 3).join("-");
  if (!productName) return null;
  const words = productName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join("-");
}

/**
 * Real DOCX extraction. Reads the submitted Word binary with mammoth, combines
 * table cell pairs with labelled text lines, and reports missing or contradictory
 * evidence instead of guessing.
 */
export async function extractStickerFromDocx(
  buffer: Buffer,
  filename: string
): Promise<ExtractedSticker> {
  const [raw, html] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  const text = raw.value.replace(/\u00a0/g, " ");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fields: Record<string, string> = {};

  // Table pairs are the strongest signal on prize stickers.
  for (const [label, value] of extractTablePairs(html.value)) {
    const normalizedLabel = label.toLowerCase().replace(/[:\s]+$/, "");
    const field = FIELD_LABELS.find((f) => f.labels.some((l) => normalizedLabel.startsWith(l)));
    if (field && value && !fields[field.key as string]) {
      fields[field.key as string] = value;
    }
  }

  // Labelled text lines fill gaps.
  for (const line of lines) {
    const match = labelMatch(line);
    if (match && !fields[match.key as string]) {
      fields[match.key as string] = match.value;
    }
  }

  // Identifier: explicit label first, then the first FRD-style token in the document.
  const identifierLabel = lines.find((line) => /^(sticker identifier|identifier|product code|sku)\b/i.test(line));
  const identifier =
    normalizeIdentifier(identifierLabel?.replace(/^[^:\-]+[:\-]/, "") ?? null) ??
    normalizeIdentifier(lines.join(" ")) ??
    normalizeIdentifier(filename);

  const productName = fields.productName?.trim() || null;
  const mrpValues = Array.from(
    new Set(
      (text.match(new RegExp(MRP_PATTERN, "gi")) ?? [])
        .map((entry) => parseMrp(entry))
        .filter((value): value is number => value !== null)
    )
  );
  const declaredMrp = parseMrp(fields.mrp ?? null) ?? (mrpValues.length === 1 ? mrpValues[0] : null);

  // Critical fields: absence blocks automatic matching confirmation.
  const criticalMissing: string[] = [];
  if (!identifier) criticalMissing.push("Sticker Identifier");
  if (!productName) criticalMissing.push("Product Name");
  if (!declaredMrp) criticalMissing.push("MRP");

  // Informational fields: absence is recorded as a warning but does NOT block confirmation.
  const informationalMissing: string[] = [];
  if (!fields.netQuantity) informationalMissing.push("Net Quantity");
  if (!fields.dimensions) informationalMissing.push("Dimensions");
  if (!fields.marketedBy && !fields.packagedBy) informationalMissing.push("Packaged & Marketed By");

  // missingFields preserves the full list for UI display (Sticker Library, Inspect drawer).
  const missingFields: string[] = [...criticalMissing, ...informationalMissing];

  const conflicts: string[] = [];
  if (mrpValues.length > 1) {
    conflicts.push(`Multiple different MRP values found: ${mrpValues.map((v) => `₹${v}`).join(", ")}`);
  }
  if (!productName && !fields.commonName) {
    conflicts.push("Document has no identifiable product name in its tables or text.");
  }

  // Only truly blocking issues cause needs_attention.
  // Informational-only warnings keep extractionStatus as "extracted".
  const extractionStatus: ExtractedSticker["extractionStatus"] =
    conflicts.length > 0 || criticalMissing.length > 0 ? "needs_attention" : "extracted";

  const notes: string[] = [];
  if (conflicts.length > 0) notes.push(conflicts.join(" "));
  if (criticalMissing.length > 0) {
    notes.push(
      `Missing critical field(s): ${criticalMissing.join(", ")}. Automatic confirmation is blocked until verified.`
    );
  }
  if (informationalMissing.length > 0) {
    notes.push(`Informational warning — missing field(s): ${informationalMissing.join(", ")}.`);
  }
  const extractionNote = notes.length > 0 ? notes.join(" ") : null;

  const marketedValue = fields.marketedBy ?? fields.packagedBy ?? null;

  return {
    stickerIdentifier: identifier,
    productName,
    commonName: fields.commonName ?? null,
    netQuantity: fields.netQuantity ?? null,
    dimensions: fields.dimensions ?? null,
    colorVariant: fields.colorVariant ?? null,
    sizeVariant: fields.sizeVariant ?? null,
    manufacturingMonthYear: fields.manufacturingMonthYear ?? null,
    batchNumber: fields.batchNumber ?? null,
    packagedBy: fields.packagedBy ?? null,
    marketedBy: marketedValue,
    countryOfOrigin: fields.countryOfOrigin ?? null,
    mrp: declaredMrp,
    customerCare: fields.customerCare ?? null,
    missingFields,
    extractionStatus,
    extractionNote,
    familyKey: familyKey(identifier, productName),
    rawText: text.slice(0, 20000),
  };
}
