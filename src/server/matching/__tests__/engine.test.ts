import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  matchBatch,
  matchProduct,
  type EngineMapping,
  type EngineProduct,
  type EngineSticker,
} from "@/server/matching/engine";

const product = (overrides: Partial<EngineProduct> = {}): EngineProduct => ({
  id: "p1",
  rowNumber: 2,
  productCode: "FRD-SIT-CX-BLK",
  name: "Frido Ultimate Coccyx Cushion Black",
  scanIdentifier: "8906000010011",
  brand: "Frido",
  color: "Jet Black",
  size: "Standard",
  lengthCm: "45",
  widthCm: "36",
  heightCm: "8",
  mrp: 1999,
  ...overrides,
});

const sticker = (overrides: Partial<EngineSticker> = {}): EngineSticker => ({
  id: "s1",
  stickerIdentifier: "FRD-SIT-CX-BLK",
  productName: "Frido Ultimate Coccyx Cushion Black",
  colorVariant: "Jet Black",
  sizeVariant: "Standard",
  mrp: 1999,
  dimensions: "45 x 36 x 8",
  netQuantity: "1 Unit",
  extractionStatus: "extracted",
  familyKey: "FRD-SIT-CX",
  ...overrides,
});

const mapping = (overrides: Partial<EngineMapping> = {}): EngineMapping => ({
  id: "m1",
  familyKey: "frido-coccyx",
  stickerIdentifier: "FRD-SIT-CX-BLK",
  csvPattern: "FRD-SIT-CX-BLK-*",
  matchField: "product_code",
  isActive: true,
  ...overrides,
});

describe("matching engine", () => {
  it("confirms an exact verified sticker identifier when evidence aligns", () => {
    const result = matchProduct(product(), [sticker()], []);
    expect(result.status).toBe("confirmed");
    expect(result.ruleId).toBe("R2_EXACT_IDENTIFIER");
    expect(result.evidence.some((entry) => entry.code === "E-EXACT-IDENTIFIER")).toBe(true);
  });

  it("confirms through the scan identifier when the product code differs", () => {
    const result = matchProduct(
      product({ productCode: "FRD-RETAIL-001", scanIdentifier: "FRD-SIT-CX-BLK" }),
      [sticker()],
      []
    );
    expect(result.status).toBe("confirmed");
    expect(result.ruleId).toBe("R2_EXACT_IDENTIFIER");
  });

  it("never confirms on prefix similarity alone", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-NEW", scanIdentifier: null }),
      [sticker()],
      []
    );
    expect(result.status).not.toBe("confirmed");
    expect(result.status).toBe("needs_review");
    expect(result.ruleId).toBe("R4_ATTRIBUTE_CANDIDATE");
  });

  it("never confirms from product-name similarity alone", () => {
    const result = matchProduct(
      product({ productCode: "TOTALLY-DIFFERENT", name: "Frido Ultimate Coccyx Cushion Black", scanIdentifier: null, mrp: 1999 }),
      [sticker({ stickerIdentifier: "FRD-SIT-CX-GRY", familyKey: "FRD-SIT-CX", colorVariant: "Slate Grey" })],
      []
    );
    expect(result.status).toBe("needs_review");
  });

  it("confirms an explicitly approved product mapping", () => {
    const result = matchProduct(product(), [sticker()], [mapping({ csvPattern: "FRD-SIT-CX-BLK" })]);
    expect(result.status).toBe("confirmed");
    expect(result.matchType).toBe("exact_approved_mapping");
    expect(result.ruleId).toBe("R1_EXACT_APPROVED_MAPPING");
  });

  it("keeps approved family mappings with variant differences in review", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-26", color: "Obsidian Black" }),
      [sticker()],
      [mapping()]
    );
    expect(result.status).toBe("needs_review");
    expect(result.ruleId).toBe("R3_APPROVED_FAMILY_MAPPING");
    expect(result.evidence.some((entry) => entry.code === "W-VARIANT-DIFFERS")).toBe(true);
  });

  it("confirms an approved family mapping when attributes align", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-26" }),
      [sticker()],
      [mapping()]
    );
    expect(result.status).toBe("confirmed");
    expect(result.ruleId).toBe("R3_APPROVED_FAMILY_MAPPING");
  });

  it("raises a conflict when MRP contradicts the exact reference", () => {
    const result = matchProduct(product({ mrp: 2499 }), [sticker()], []);
    expect(result.status).toBe("conflict");
    expect(result.conflictWarnings.join(" ")).toContain("MRP");
    expect(result.evidence.some((entry) => entry.code === "C-MRP-MISMATCH")).toBe(true);
  });

  it("does not confirm when the sticker reference is missing an MRP", () => {
    const result = matchProduct(product(), [sticker({ mrp: null })], []);
    expect(result.status).toBe("needs_review");
    expect(result.evidence.some((entry) => entry.code === "W-MRP-MISSING")).toBe(true);
  });

  it("flags an exact identifier collision instead of guessing", () => {
    const result = matchProduct(
      product(),
      [sticker({ id: "s1" }), sticker({ id: "s2" })],
      []
    );
    expect(result.status).toBe("conflict");
    expect(result.ruleId).toBe("R2_EXACT_IDENTIFIER_COLLISION");
    expect(result.candidateStickerIds).toHaveLength(2);
  });

  it("blocks automatic confirmation when the sticker is marked conflicted", () => {
    const result = matchProduct(
      product(),
      [sticker({ extractionStatus: "conflicted", extractionNote: "Two different MRP values." })],
      []
    );
    expect(result.status).toBe("conflict");
    expect(result.evidence.some((entry) => entry.code === "C-STICKER-CONFLICTED")).toBe(true);
  });

  it("blocks confirmation when the sticker extraction is incomplete", () => {
    const result = matchProduct(
      product(),
      [sticker({ extractionStatus: "needs_attention", extractionNote: "Dimensions missing." })],
      []
    );
    expect(result.status).toBe("needs_review");
    expect(result.evidence.some((entry) => entry.code === "W-STICKER-INCOMPLETE")).toBe(true);
  });

  it("classifies unmatched when no relevant reference exists", () => {
    const result = matchProduct(
      product({ productCode: "FRD-WALK-RECOVERY-SLIDE-M", name: "Frido CloudWalk Recovery Slides", scanIdentifier: null }),
      [sticker()],
      []
    );
    expect(result.status).toBe("unmatched");
    expect(result.ruleId).toBe("R5_NO_CANDIDATE");
    expect(result.stickerId).toBeNull();
  });

  it("reports conflicts when multiple incompatible families are candidates", () => {
    const candidates = [
      sticker({ id: "s1", stickerIdentifier: "FRD-SIT-CX-BLK", familyKey: "FRD-SIT-CX" }),
      sticker({ id: "s2", stickerIdentifier: "FRD-SIT-CA-BLK", familyKey: "FRD-SIT-CA" }),
    ];
    const result = matchProduct(
      product({ productCode: "FRD-SIT-C-BLK", scanIdentifier: null }),
      candidates,
      []
    );
    expect(["conflict", "needs_review"]).toContain(result.status);
    expect(result.status).not.toBe("confirmed");
    expect(result.candidateStickerIds.length).toBeGreaterThan(0);
  });

  it("stamps rule id, engine version and evidence on every batch result", () => {
    const results = matchBatch(
      [product(), product({ id: "p2", productCode: "FRD-WALK-RECOVERY-SLIDE-M", name: "Frido CloudWalk Recovery Slide", scanIdentifier: null, color: "Mustard Yellow" })],
      [sticker()],
      []
    );
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.ruleId.length).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.attributeComparisons.length).toBeGreaterThan(0);
    }
    expect(results[0].status).toBe("confirmed");
    expect(results[1].status).toBe("unmatched");
    expect(ENGINE_VERSION).toBe("2.0.0");
  });
});

/* ---------------------------------------------------------------- evidence */
import { compareDimensions, parseDimensions, parseNetQuantity } from "@/server/matching/engine";

const comparison = (rows: Array<{ attribute: string }> | undefined, attribute: string) =>
  (rows ?? []).find((row) => row.attribute === attribute) as
    | { csvValue: string | null; stickerValue: string | null; alignment: string }
    | undefined;

describe("evidence must be truthful", () => {
  it("parses structured dimensions and compares with tolerance", () => {
    expect(parseDimensions("45.0 cm × 36.0 cm × 8.0 cm")).toEqual([45, 36, 8]);
    expect(parseDimensions("1 Pair only")).toBeNull();
    expect(compareDimensions([45, 36, 8], [45, 36, 8])).toBe("match");
    expect(compareDimensions([45, 36, 8], [45, 36, 9.5])).toBe("differs");
    expect(compareDimensions([45, 36], null)).toBe("missing");
    expect(compareDimensions([45], [45])).toBe("missing");
  });

  it("parses genuine net quantity expressions only", () => {
    expect(parseNetQuantity("1 Pair (2 Units)")).toEqual({ count: 1, unit: "pair" });
    expect(parseNetQuantity("2 sets")).toEqual({ count: 2, unit: "set" });
    expect(parseNetQuantity("Assorted")).toBeNull();
  });

  it("never fabricates a sticker colour or size from the product name", () => {
    const result = matchProduct(
      product({ color: "Jet Black", size: "Standard" }),
      [sticker({ colorVariant: null, sizeVariant: null })],
      []
    );
    const colour = comparison(result.attributeComparisons, "Colour");
    const size = comparison(result.attributeComparisons, "Size / Variant");
    expect(colour?.stickerValue).toBe("Not available on sticker reference");
    expect(colour?.alignment).toBe("missing");
    expect(size?.stickerValue).toBe("Not available on sticker reference");
    expect(size?.alignment).toBe("missing");
    // Missing evidence must not be reported as a match anywhere.
    expect(result.attributeComparisons.some((row) => row.alignment === "match" && row.stickerValue === null)).toBe(false);
  });

  it("compares dimensions only when both sides are structured", () => {
    const aligned = matchProduct(product(), [sticker({ dimensions: "45 cm x 36 cm x 8 cm" })], []);
    expect(comparison(aligned.attributeComparisons, "Dimensions")?.alignment).toBe("match");

    const differing = matchProduct(product(), [sticker({ dimensions: "50 cm x 40 cm x 10 cm" })], []);
    expect(comparison(differing.attributeComparisons, "Dimensions")?.alignment).toBe("differs");

    const unstructured = matchProduct(product(), [sticker({ dimensions: "See packaging" })], []);
    expect(comparison(unstructured.attributeComparisons, "Dimensions")?.alignment).toBe("missing");
  });

  it("marks the CSV side of net quantity as not present in the Item Master", () => {
    const result = matchProduct(product(), [sticker({ netQuantity: "1 Pair" })], []);
    const quantity = comparison(result.attributeComparisons, "Net Quantity");
    expect(quantity?.csvValue).toBe("Not present in Item Master");
    expect(quantity?.alignment).toBe("missing");
  });

  it("matches colour only against a genuine extracted colour field", () => {
    const same = matchProduct(product({ color: "Jet Black" }), [sticker({ colorVariant: "Jet Black" })], []);
    expect(comparison(same.attributeComparisons, "Colour")?.alignment).toBe("match");

    const different = matchProduct(product({ color: "Obsidian Black" }), [sticker({ colorVariant: "Jet Black" })], []);
    expect(comparison(different.attributeComparisons, "Colour")?.alignment).toBe("differs");
  });

  it("downgrades an approved family mapping when the colour genuinely differs", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-26", color: "Slate Grey" }),
      [sticker({ colorVariant: "Jet Black", extractionStatus: "extracted" })],
      [mapping()]
    );
    expect(result.status).toBe("needs_review");
    expect(result.evidence.some((entry) => entry.code === "W-VARIANT-DIFFERS")).toBe(true);
  });

  it("does not claim a variant difference when colour data is unavailable", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-26" }),
      [sticker({ colorVariant: null, sizeVariant: null })],
      [mapping()]
    );
    expect(result.evidence.some((entry) => entry.code === "W-VARIANT-DIFFERS")).toBe(false);
  });
});
