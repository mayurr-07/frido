/**
 * Frido deterministic prize-sticker matching engine.
 *
 * Design rules (non-negotiable):
 *  - Never confirm a product from prefix similarity or name similarity alone.
 *  - Never confirm when the sticker reference is incomplete/conflicted.
 *  - Unresolved MRP contradiction is always a conflict.
 *  - Every result carries the rule id, engine version and human-readable evidence.
 *  - Approved product-family mappings are explicit human decisions (database layer).
 *
 * This module is pure (no database / network imports) so it can be unit tested
 * and reused by background workers.
 */

export const ENGINE_VERSION = "2.0.0";

export type EngineStatus = "confirmed" | "needs_review" | "conflict" | "unmatched";

export type EngineProduct = {
  id: string;
  rowNumber: number;
  categoryCode?: string | null;
  productCode: string;
  name?: string | null;
  description?: string | null;
  scanIdentifier?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  lengthCm?: string | null;
  widthCm?: string | null;
  heightCm?: string | null;
  weightG?: string | null;
  mrp?: number | null;
  type?: string | null;
  catalogCategory?: string | null;
};

export type EngineSticker = {
  id: string;
  stickerIdentifier: string;
  productName: string;
  commonName?: string | null;
  colorVariant?: string | null;
  sizeVariant?: string | null;
  mrp?: number | null;
  dimensions?: string | null;
  netQuantity?: string | null;
  extractionStatus: "extracted" | "needs_attention" | "conflicted";
  extractionNote?: string | null;
  familyKey?: string | null;
};

export type EngineMapping = {
  id: string;
  familyKey: string;
  stickerIdentifier: string;
  csvPattern: string;
  matchField: "product_code" | "scan_identifier";
  isActive: boolean;
  note?: string | null;
};

export type Evidence = {
  code: string;
  type: "positive" | "warning" | "conflict" | "neutral";
  title: string;
  detail: string;
};

export type AttributeComparison = {
  attribute: string;
  csvValue: string | null;
  stickerValue: string | null;
  alignment: "match" | "differs" | "missing" | "conflict";
};

export type EngineResult = {
  productId: string;
  status: EngineStatus;
  matchType:
    | "exact_approved_mapping"
    | "exact_identifier"
    | "approved_family"
    | "attribute_candidate"
    | "no_reference";
  ruleId: string;
  ruleApplied: string;
  stickerId: string | null;
  candidateStickerIds: string[];
  reviewReason: string | null;
  conflictWarnings: string[];
  evidence: Evidence[];
  attributeComparisons: AttributeComparison[];
};

/* ------------------------------------------------------------------ helpers */
const normalizeCode = (value?: string | null): string =>
  (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

const normalizeText = (value?: string | null): string =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");

const significantTokens = (value?: string | null): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((t) => t.length > 2 && !["the", "and", "for", "with", "frido", "ultimate"].includes(t));

/** Family key derived from an identifier, e.g. FRD-INS-DG-M => frd-ins-dg */
export function deriveFamilyKey(identifier?: string | null): string {
  const segments = normalizeCode(identifier).split("-").filter(Boolean);
  return segments.slice(0, 3).join("-");
}

function wildcardMatch(pattern: string, value: string): boolean {
  const p = normalizeCode(pattern);
  const v = normalizeCode(value);
  if (!p.endsWith("*")) return p === v;
  return v.startsWith(p.slice(0, -1));
}

/**
 * Parse a dimension string such as "45.0 cm × 36.0 cm × 8.0 cm" into ordered numbers.
 * Returns null when fewer than two comparable measurements are present, so incomplete
 * evidence is never treated as a match.
 */
export function parseDimensions(value?: string | null): number[] | null {
  if (!value) return null;
  const numbers = value
    .replace(/[^0-9.,\s×xX*/-]/g, " ")
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((token) => Number(token.replace(",", ".")))
    .filter((num) => Number.isFinite(num) && num > 0);
  if (!numbers || numbers.length < 2) return null;
  return numbers.slice(0, 3);
}

/** Compare two structured measurements with a small manufacturing tolerance. */
export function compareDimensions(
  csv: number[] | null,
  sticker: number[] | null
): "match" | "differs" | "missing" {
  if (!csv || !sticker) return "missing";
  if (csv.length !== sticker.length) return "differs";
  if (csv.length < 2) return "missing";
  const comparable = csv.map((value, index) => ({ csv: value, sticker: sticker[index] }));
  const allMatch = comparable.every(
    (pair) => Math.abs(pair.csv - pair.sticker) / Math.max(pair.csv, pair.sticker) <= 0.05
  );
  return allMatch ? "match" : "differs";
}

/**
 * Parse a net quantity string into a comparable {count, unit}. Only genuine quantity
 * expressions are accepted; free text returns null ("not verifiable").
 */
export function parseNetQuantity(value?: string | null): { count: number; unit: string } | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(pair|pairs|unit|units|piece|pieces|set|sets|pc|pcs|ml|g|kg)?/i);
  if (!match) return null;
  const count = Number(match[1].replace(",", "."));
  if (!Number.isFinite(count) || count <= 0) return null;
  const rawUnit = (match[2] ?? "").toLowerCase();
  const unit = rawUnit.startsWith("pair")
    ? "pair"
    : rawUnit.startsWith("set")
    ? "set"
    : ["ml", "g", "kg"].includes(rawUnit)
    ? rawUnit
    : "unit";
  return { count, unit };
}

const NOT_AVAILABLE = "Not available on sticker reference";
const NOT_VERIFIABLE = "Not present in Item Master";

const money = (value?: number | null): string | null =>
  value === null || value === undefined || Number.isNaN(value)
    ? null
    : `₹${Number(value).toLocaleString("en-IN")}`;

function attributeComparisons(
  product: EngineProduct,
  sticker: EngineSticker | null
): AttributeComparison[] {
  if (!sticker) {
    return [
      { attribute: "Product Code", csvValue: product.productCode, stickerValue: null, alignment: "missing" },
      { attribute: "MRP", csvValue: money(product.mrp), stickerValue: null, alignment: "missing" },
    ];
  }

  const mrpBothPresent =
    product.mrp !== null && product.mrp !== undefined && sticker.mrp !== null && sticker.mrp !== undefined;
  const mrpConflict = mrpBothPresent && Number(product.mrp) !== Number(sticker.mrp);

  const csvDimensions = parseDimensions(
    [product.lengthCm, product.widthCm, product.heightCm].filter(Boolean).join(" × ")
  );
  const stickerDimensions = parseDimensions(sticker.dimensions);
  const parsedQuantity = parseNetQuantity(sticker.netQuantity);
  const stickerNetQuantity = parsedQuantity
    ? { ...parsedQuantity, display: sticker.netQuantity ?? `${parsedQuantity.count} ${parsedQuantity.unit}` }
    : null;

  const rows: AttributeComparison[] = [
    {
      attribute: "Product Code / Identifier",
      csvValue: product.productCode,
      stickerValue: sticker.stickerIdentifier,
      alignment:
        normalizeCode(product.productCode) === normalizeCode(sticker.stickerIdentifier) ? "match" : "differs",
    },
    {
      attribute: "Scan Identifier",
      csvValue: product.scanIdentifier ?? null,
      stickerValue: sticker.stickerIdentifier,
      alignment: !product.scanIdentifier
        ? "missing"
        : normalizeCode(product.scanIdentifier) === normalizeCode(sticker.stickerIdentifier)
        ? "match"
        : "differs",
    },
    {
      attribute: "MRP",
      csvValue: money(product.mrp),
      stickerValue: money(sticker.mrp),
      alignment: !mrpBothPresent ? "missing" : mrpConflict ? "conflict" : "match",
    },
    {
      // Colour may only be compared against a genuine extracted colour field.
      attribute: "Colour",
      csvValue: product.color ?? NOT_VERIFIABLE,
      stickerValue: sticker.colorVariant ?? NOT_AVAILABLE,
      alignment:
        !product.color || !sticker.colorVariant
          ? "missing"
          : normalizeText(product.color) === normalizeText(sticker.colorVariant)
          ? "match"
          : "differs",
    },
    {
      // Size/variant may only be compared against a genuine extracted size field.
      attribute: "Size / Variant",
      csvValue: product.size ?? NOT_VERIFIABLE,
      stickerValue: sticker.sizeVariant ?? NOT_AVAILABLE,
      alignment:
        !product.size || !sticker.sizeVariant
          ? "missing"
          : normalizeText(product.size) === normalizeText(sticker.sizeVariant) ||
            normalizeText(product.size).includes(normalizeText(sticker.sizeVariant)) ||
            normalizeText(sticker.sizeVariant).includes(normalizeText(product.size))
          ? "match"
          : "differs",
    },
    {
      // Dimensions are only compared when both sides expose structured measurements.
      attribute: "Dimensions",
      csvValue: csvDimensions ? csvDimensions.join(" × ") : NOT_VERIFIABLE,
      stickerValue: stickerDimensions ? stickerDimensions.join(" × ") : NOT_AVAILABLE,
      alignment: compareDimensions(csvDimensions, stickerDimensions),
    },
    {
      // The Item Master has no quantity column: the sticker quantity is reference-only.
      attribute: "Net Quantity",
      csvValue: stickerNetQuantity ? NOT_VERIFIABLE : "—",
      stickerValue: stickerNetQuantity ? stickerNetQuantity.display : NOT_AVAILABLE,
      alignment: "missing",
    },
  ];
  return rows;
}

function inspectSticker(
  sticker: EngineSticker,
  duplicateIdentifierCount: number,
  product: EngineProduct
): { blocked: "conflict" | "needs_review" | null; warnings: string[]; evidence: Evidence[] } {
  const warnings: string[] = [];
  const evidence: Evidence[] = [];
  let blocked: "conflict" | "needs_review" | null = null;

  if (duplicateIdentifierCount > 1) {
    warnings.push(
      `Sticker identifier ${sticker.stickerIdentifier} appears on ${duplicateIdentifierCount} reference documents.`
    );
    evidence.push({
      code: "C-DUPLICATE-IDENTIFIER",
      type: "conflict",
      title: "Exact identifier collision",
      detail: `${duplicateIdentifierCount} sticker documents share the identifier ${sticker.stickerIdentifier}; identity cannot be verified automatically.`,
    });
    blocked = "conflict";
  }

  if (sticker.extractionStatus === "conflicted") {
    warnings.push(`Reference ${sticker.stickerIdentifier} is flagged as internally conflicted.`);
    evidence.push({
      code: "C-STICKER-CONFLICTED",
      type: "conflict",
      title: "Sticker reference contains contradictions",
      detail: sticker.extractionNote ?? "Contradictory fields were detected during extraction; the reference is blocked from automatic confirmation.",
    });
    blocked = "conflict";
  }

  if (sticker.extractionStatus === "needs_attention") {
    evidence.push({
      code: "W-STICKER-INCOMPLETE",
      type: "warning",
      title: "Sticker extraction incomplete",
      detail: sticker.extractionNote ?? "The reference document is missing required fields, so automatic confirmation is blocked.",
    });
    if (!blocked) blocked = "needs_review";
  }

  const mrpBothPresent =
    product.mrp !== null && product.mrp !== undefined && sticker.mrp !== null && sticker.mrp !== undefined;
  if (mrpBothPresent && Number(product.mrp) !== Number(sticker.mrp)) {
    warnings.push(`MRP conflict: CSV ${money(product.mrp)} vs sticker ${money(sticker.mrp)}.`);
    evidence.push({
      code: "C-MRP-MISMATCH",
      type: "conflict",
      title: "MRP contradicts the prize sticker",
      detail: `Item Master lists ${money(product.mrp)} while ${sticker.stickerIdentifier} lists ${money(sticker.mrp)}.`,
    });
    blocked = "conflict";
  } else if (!mrpBothPresent) {
    evidence.push({
      code: "W-MRP-MISSING",
      type: "warning",
      title: "MRP evidence incomplete",
      detail: "One of the two sources has no MRP value, so price alignment is unverified.",
    });
    if (!blocked) blocked = "needs_review";
  }

  return { blocked, warnings, evidence };
}

function nameTokensMatch(product: EngineProduct, sticker: EngineSticker): boolean {
  const stickerTokens = new Set(significantTokens(`${sticker.productName} ${sticker.commonName ?? ""}`));
  if (stickerTokens.size === 0) return false;
  const overlaps = significantTokens(product.name).filter((token) => stickerTokens.has(token));
  return overlaps.length >= 2;
}

/* -------------------------------------------------------------------- engine */
export function matchProduct(
  product: EngineProduct,
  stickers: EngineSticker[],
  mappings: EngineMapping[]
): EngineResult {
  const code = normalizeCode(product.productCode);
  const scan = normalizeCode(product.scanIdentifier);
  const duplicateCounts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = normalizeCode(sticker.stickerIdentifier);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }
  const stickerByIdentifier = (identifier: string) =>
    stickers.find((s) => normalizeCode(s.stickerIdentifier) === normalizeCode(identifier));
  const activeMappings = mappings.filter((m) => m.isActive);

  /* -------- R0: overlapping mapping conflict detection ----------------- */
  const matchingActiveMappings = activeMappings.filter((m) => {
    const source = m.matchField === "scan_identifier" ? scan : code;
    return wildcardMatch(m.csvPattern, source);
  });
  if (matchingActiveMappings.length > 1) {
    const overlapStickers = matchingActiveMappings
      .map((m) => stickerByIdentifier(m.stickerIdentifier))
      .filter((s): s is EngineSticker => s !== undefined);
    return {
      productId: product.id,
      status: "conflict",
      matchType: "exact_approved_mapping",
      ruleId: "R0_MAPPING_OVERLAP",
      ruleApplied: "R0 · Overlapping mapping conflict — multiple active patterns match this product",
      stickerId: null,
      candidateStickerIds: overlapStickers.map((s) => s.id),
      reviewReason: `Multiple active mapping patterns (${matchingActiveMappings.map((m) => m.csvPattern).join(", ")}) match ${product.productCode}; ambiguity must be resolved manually.`,
      conflictWarnings: [
        `Overlapping mappings detected: ${matchingActiveMappings.map((m) => `"${m.csvPattern}" → ${m.stickerIdentifier}`).join(", ")}`,
      ],
      evidence: [
        {
          code: "C-MAPPING-OVERLAP",
          type: "conflict",
          title: "Multiple active mapping patterns overlap",
          detail: `Patterns ${matchingActiveMappings.map((m) => `"${m.csvPattern}"`).join(", ")} all match product code / scan identifier. Deactivate all but one before this product can be automatically classified.`,
        },
      ],
      attributeComparisons: attributeComparisons(product, overlapStickers[0] ?? null),
    };
  }

  /* -------- R1: exact approved product-to-sticker mapping -------------- */
  const exactMapping = activeMappings.find((m) => {
    const source = m.matchField === "scan_identifier" ? scan : code;
    return !m.csvPattern.includes("*") && wildcardMatch(m.csvPattern, source);
  });
  if (exactMapping) {
    const sticker = stickerByIdentifier(exactMapping.stickerIdentifier);
    if (sticker) {
      const inspection = inspectSticker(
        sticker,
        duplicateCounts.get(normalizeCode(sticker.stickerIdentifier)) ?? 0,
        product
      );
      const status: EngineStatus = inspection.blocked ?? "confirmed";
      return {
        productId: product.id,
        status,
        matchType: "exact_approved_mapping",
        ruleId: "R1_EXACT_APPROVED_MAPPING",
        ruleApplied: "R1 · Exact approved product-to-sticker mapping",
        stickerId: sticker.id,
        candidateStickerIds: [sticker.id],
        reviewReason:
          status === "confirmed"
            ? null
            : `Approved mapping found for ${product.productCode}, but the reference currently blocks automatic confirmation.`,
        conflictWarnings: inspection.warnings,
        evidence: [
          {
            code: "E-APPROVED-MAPPING",
            type: "positive",
            title: "Human-approved mapping",
            detail: `Mapping "${exactMapping.csvPattern}" → ${sticker.stickerIdentifier} was explicitly approved (${exactMapping.familyKey}).${exactMapping.note ? ` Note: ${exactMapping.note}` : ""}`,
          },
          ...inspection.evidence,
        ],
        attributeComparisons: attributeComparisons(product, sticker),
      };
    }
  }

  /* -------- R2: exact verified sticker identifier ---------------------- */
  const identifierCandidates = stickers.filter(
    (s) =>
      (code && normalizeCode(s.stickerIdentifier) === code) ||
      (scan && normalizeCode(s.stickerIdentifier) === scan)
  );
  if (identifierCandidates.length > 1) {
    return {
      productId: product.id,
      status: "conflict",
      matchType: "exact_identifier",
      ruleId: "R2_EXACT_IDENTIFIER_COLLISION",
      ruleApplied: "R2 · Exact identifier collision detected",
      stickerId: null,
      candidateStickerIds: identifierCandidates.map((s) => s.id),
      reviewReason: `Multiple reference documents (${identifierCandidates.length}) share the exact identifier of ${product.productCode}.`,
      conflictWarnings: [
        `Exact identifier collision: ${identifierCandidates.map((s) => s.stickerIdentifier).join(", ")}`,
      ],
      evidence: [
        {
          code: "C-IDENTIFIER-COLLISION",
          type: "conflict",
          title: "Multiple references match the exact identifier",
          detail: `Documents ${identifierCandidates.map((s) => s.stickerIdentifier).join(", ")} cannot be distinguished automatically. Manual verification is mandatory.`,
        },
      ],
      attributeComparisons: attributeComparisons(product, identifierCandidates[0] ?? null),
    };
  }
  const exactSticker = identifierCandidates[0];
  if (exactSticker) {
    const inspection = inspectSticker(
      exactSticker,
      duplicateCounts.get(normalizeCode(exactSticker.stickerIdentifier)) ?? 0,
      product
    );
    const status: EngineStatus = inspection.blocked ?? "confirmed";
    return {
      productId: product.id,
      status,
      matchType: "exact_identifier",
      ruleId: "R2_EXACT_IDENTIFIER",
      ruleApplied: "R2 · Exact verified sticker identifier",
      stickerId: exactSticker.id,
      candidateStickerIds: [exactSticker.id],
      reviewReason:
        status === "confirmed"
          ? null
          : "The exact identifier matches, but the reference data blocks automatic confirmation.",
      conflictWarnings: inspection.warnings,
      evidence: [
        {
          code: "E-EXACT-IDENTIFIER",
          type: "positive",
          title: "Exact identifier match",
          detail: `Item Master ${scan && scan === normalizeCode(exactSticker.stickerIdentifier) ? `scan identifier ${product.scanIdentifier}` : `product code ${product.productCode}`} equals sticker identifier ${exactSticker.stickerIdentifier}.`,
        },
        ...inspection.evidence,
      ],
      attributeComparisons: attributeComparisons(product, exactSticker),
    };
  }

  /* -------- R3: explicit approved product-family mapping --------------- */
  const familyMapping = activeMappings.find((m) => {
    const source = m.matchField === "scan_identifier" ? scan : code;
    return m.csvPattern.includes("*") && wildcardMatch(m.csvPattern, source);
  });
  if (familyMapping) {
    const sticker = stickerByIdentifier(familyMapping.stickerIdentifier);
    if (sticker) {
      const inspection = inspectSticker(
        sticker,
        duplicateCounts.get(normalizeCode(sticker.stickerIdentifier)) ?? 0,
        product
      );
      const comparisons = attributeComparisons(product, sticker);
      const variantDiffers = comparisons.some(
        (row) =>
          (row.attribute === "Colour" || row.attribute === "Size / Variant") &&
          row.alignment === "differs"
      );
      const status: EngineStatus = inspection.blocked
        ? inspection.blocked
        : variantDiffers
        ? "needs_review"
        : "confirmed";

      return {
        productId: product.id,
        status,
        matchType: "approved_family",
        ruleId: "R3_APPROVED_FAMILY_MAPPING",
        ruleApplied: "R3 · Explicit approved family-to-SKU mapping",
        stickerId: sticker.id,
        candidateStickerIds: [sticker.id],
        reviewReason:
          status === "confirmed"
            ? null
            : variantDiffers
            ? "Approved family mapping applied, but the colour/size variant differs from the reference."
            : "Approved family mapping applied, but the reference blocks automatic confirmation.",
        conflictWarnings: inspection.warnings,
        evidence: [
          {
            code: "E-FAMILY-MAPPING",
            type: "positive",
            title: "Approved family mapping",
            detail: `Pattern "${familyMapping.csvPattern}" is explicitly mapped to ${sticker.stickerIdentifier}${familyMapping.note ? ` — ${familyMapping.note}` : ""}.`,
          },
          ...(variantDiffers
            ? [
                {
                  code: "W-VARIANT-DIFFERS",
                  type: "warning" as const,
                  title: "Variant differs",
                  detail: "Colour or size on the Item Master does not match the reference sticker rendition.",
                },
              ]
            : []),
          ...inspection.evidence,
        ],
        attributeComparisons: comparisons,
      };
    }
  }

  /* -------- R4: attribute-based candidates (never auto-confirmed) ------ */
  const productFamily = deriveFamilyKey(product.productCode);
  const scored = stickers
    .map((sticker) => {
      const stickerFamily = deriveFamilyKey(sticker.stickerIdentifier);
      const familyMatch = normalizeCode(sticker.familyKey ?? "") === normalizeCode(productFamily);
      const identifierPrefix =
        code.startsWith(normalizeCode(sticker.stickerIdentifier)) ||
        normalizeCode(sticker.stickerIdentifier).startsWith(code.slice(0, Math.max(6, code.length - 3)));
      const namesMatch = nameTokensMatch(product, sticker);
      const sameDerivedFamily = Boolean(productFamily) && stickerFamily === productFamily;
      const relevance = [familyMatch, identifierPrefix, namesMatch, sameDerivedFamily].filter(Boolean).length;
      return { sticker, relevance };
    })
    .filter((entry) => entry.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);

  const candidates = scored.slice(0, 3).map((entry) => entry.sticker);

  if (candidates.length === 0) {
    return {
      productId: product.id,
      status: "unmatched",
      matchType: "no_reference",
      ruleId: "R5_NO_CANDIDATE",
      ruleApplied: "R5 · No sufficiently relevant sticker reference",
      stickerId: null,
      candidateStickerIds: [],
      reviewReason: "No existing Word prize-sticker reference corresponds to this product.",
      conflictWarnings: [],
      evidence: [
        {
          code: "N-NO-CANDIDATE",
          type: "neutral",
          title: "No matching reference found",
          detail: `Checked ${stickers.length} permanent sticker references; no identifier, family, or name evidence reached the candidate threshold.`,
        },
      ],
      attributeComparisons: attributeComparisons(product, null),
    };
  }

  const primary = candidates[0];
  const distinctFamilies = new Set(candidates.map((c) => deriveFamilyKey(c.stickerIdentifier)));
  const multipleIncompatible = candidates.length > 1 && distinctFamilies.size > 1;
  const evidence: Evidence[] = [
    {
      code: "W-CANDIDATE-ONLY",
      type: "warning",
      title: "Candidate evidence is not conclusive",
      detail: `Similarity signals selected ${candidates.length} possible reference(s), but prefix or product-name similarity can never confirm a match.`,
    },
  ];
  if (candidates.length > 1) {
    evidence.push({
      code: "W-MULTIPLE-CANDIDATES",
      type: "warning",
      title: "Multiple sticker references found",
      detail: candidates.map((c) => c.stickerIdentifier).join(", "),
    });
  }

  const inspection = inspectSticker(
    primary,
    duplicateCounts.get(normalizeCode(primary.stickerIdentifier)) ?? 0,
    product
  );
  const status: EngineStatus = inspection.blocked
    ? inspection.blocked
    : multipleIncompatible || candidates.some((c) => c.extractionStatus === "conflicted")
    ? "conflict"
    : "needs_review";

  return {
    productId: product.id,
    status,
    matchType: "attribute_candidate",
    ruleId: "R4_ATTRIBUTE_CANDIDATE",
    ruleApplied: "R4 · Attribute-based candidate — manual review required",
    stickerId: primary.id,
    candidateStickerIds: candidates.map((c) => c.id),
    reviewReason:
      status === "conflict"
        ? "Candidate references are incompatible with each other or contradict the Item Master; resolve manually."
        : "A plausible reference exists but evidence is incomplete or variant-level differences require human verification.",
    conflictWarnings: [
      ...inspection.warnings,
      ...(multipleIncompatible
        ? [`Multiple incompatible reference families: ${Array.from(distinctFamilies).join(", ")}`]
        : []),
    ],
    evidence: [...evidence, ...inspection.evidence],
    attributeComparisons: attributeComparisons(product, primary),
  };
}

export function matchBatch(
  products: EngineProduct[],
  stickers: EngineSticker[],
  mappings: EngineMapping[]
): EngineResult[] {
  return products.map((product) => matchProduct(product, stickers, mappings));
}
