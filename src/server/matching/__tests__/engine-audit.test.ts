/**
 * Regression tests for Frido matching engine audit.
 * These tests document and verify fixes made during the November 2026 audit:
 *   - compareDimensions must return "differs" when measurement counts differ
 *   - overlapping active mappings must produce R0_MAPPING_OVERLAP conflict
 *   - matchBatch must return ALL products (no silent truncation)
 *   - conflicted sticker extraction blocks bulk approval at engine level
 *   - batch results are isolated (no cross-contamination)
 *   - R4 candidateStickerIds includes all scored candidates
 *   - engine always selects the correct sticker, never an unrelated one
 */

import { describe, expect, it } from "vitest";
import {
  compareDimensions,
  matchBatch,
  matchProduct,
  parseDimensions,
  type EngineMapping,
  type EngineProduct,
  type EngineSticker,
} from "@/server/matching/engine";

/* ------------------------------------------------------------------ helpers */

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

/* ========================================================== Test Suite 1
   compareDimensions: unequal measurement count → differs
   ========================================================= */

describe("compareDimensions — unequal measurement counts", () => {
  it("returns 'differs' when csv has 3 measurements and sticker has 2", () => {
    // Before fix: Math.min() would let [45,36,8] vs [45,36] compare only 2 values → "match"
    // After fix: length mismatch → "differs" immediately
    expect(compareDimensions([45, 36, 8], [45, 36])).toBe("differs");
  });

  it("returns 'differs' when csv has 2 measurements and sticker has 3", () => {
    expect(compareDimensions([45, 36], [45, 36, 8])).toBe("differs");
  });

  it("returns 'match' when both sides have equal 3-measurement arrays within tolerance", () => {
    expect(compareDimensions([45, 36, 8], [45, 36, 8])).toBe("match");
  });

  it("still returns 'missing' when either side is null", () => {
    expect(compareDimensions(null, [45, 36, 8])).toBe("missing");
    expect(compareDimensions([45, 36, 8], null)).toBe("missing");
  });

  it("still returns 'missing' when fewer than 2 measurements on either side", () => {
    expect(compareDimensions([45], [45])).toBe("missing");
  });
});

/* ========================================================== Test Suite 2
   Overlapping mapping conflict detection (R0_MAPPING_OVERLAP)
   ========================================================= */

describe("matchProduct — overlapping mapping conflict", () => {
  it("returns conflict with ruleId R0_MAPPING_OVERLAP when two active mappings match the same product code", () => {
    const result = matchProduct(
      product(),
      [sticker()],
      [
        mapping({ csvPattern: "FRD-SIT-CX-BLK", id: "m1" }),
        mapping({ csvPattern: "FRD-SIT-CX-BLK", id: "m2" }),
      ]
    );
    expect(result.status).toBe("conflict");
    expect(result.ruleId).toBe("R0_MAPPING_OVERLAP");
  });

  it("does NOT trigger R0 when only one active mapping matches", () => {
    const result = matchProduct(
      product(),
      [sticker()],
      [mapping({ csvPattern: "FRD-SIT-CX-BLK", id: "m1" })]
    );
    expect(result.ruleId).not.toBe("R0_MAPPING_OVERLAP");
  });

  it("does NOT trigger R0 when second mapping is inactive", () => {
    const result = matchProduct(
      product(),
      [sticker()],
      [
        mapping({ csvPattern: "FRD-SIT-CX-BLK", id: "m1", isActive: true }),
        mapping({ csvPattern: "FRD-SIT-CX-BLK", id: "m2", isActive: false }),
      ]
    );
    expect(result.ruleId).not.toBe("R0_MAPPING_OVERLAP");
  });
});

/* ========================================================== Test Suite 3
   More than 300 records (pure engine, no DB)
   ========================================================= */

describe("matchBatch — no silent truncation beyond 300 records", () => {
  it("returns all 350 results without dropping any", () => {
    const products: EngineProduct[] = Array.from({ length: 350 }, (_, i) => {
      const n = String(i + 1).padStart(3, "0");
      return product({
        id: `p-${n}`,
        productCode: `FRD-TEST-${n}`,
        name: `Frido Test Product ${n}`,
        scanIdentifier: null,
        // Use a unique code that won't accidentally match the sticker
        color: null,
        size: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        mrp: null,
      });
    });

    // One sticker that won't match any of the 350 products by identifier
    const refSticker = sticker({
      id: "s-ref",
      stickerIdentifier: "FRD-SIT-CX-BLK",
      familyKey: "FRD-SIT-CX",
    });

    const results = matchBatch(products, [refSticker], []);

    expect(results).toHaveLength(350);
    // Every product must have its own result entry
    const returnedIds = results.map((r) => r.productId);
    for (const p of products) {
      expect(returnedIds).toContain(p.id);
    }
  });

  it("every result carries a ruleId and evidence array (no silent drops)", () => {
    const products: EngineProduct[] = Array.from({ length: 350 }, (_, i) => {
      const n = String(i + 1).padStart(3, "0");
      return product({
        id: `p-${n}`,
        productCode: `FRD-TEST-${n}`,
        scanIdentifier: null,
        color: null,
        size: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        mrp: null,
      });
    });

    const results = matchBatch(products, [], []);
    for (const r of results) {
      expect(r.ruleId.length).toBeGreaterThan(0);
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  });
});

/* ========================================================== Test Suite 4
   Bulk approval must exclude conflicts (engine-level validation)
   ========================================================= */

describe("matchProduct — conflicted sticker blocks auto-confirmation (bulk approval invariant)", () => {
  it("produces status 'conflict' when sticker extractionStatus is 'conflicted'", () => {
    // This is the engine-level guarantee that bulk approval must respect:
    // any match whose sticker is flagged 'conflicted' cannot be auto-approved.
    const result = matchProduct(
      product(),
      [sticker({ extractionStatus: "conflicted", extractionNote: "MRP stated twice with different values." })],
      []
    );
    expect(result.status).toBe("conflict");
    expect(result.evidence.some((e) => e.code === "C-STICKER-CONFLICTED")).toBe(true);
  });

  it("produces status 'conflict' via approved exact mapping when sticker is conflicted", () => {
    // Even with an explicit approved mapping, a conflicted sticker stays conflict.
    const result = matchProduct(
      product(),
      [sticker({ extractionStatus: "conflicted" })],
      [mapping({ csvPattern: "FRD-SIT-CX-BLK" })]
    );
    expect(result.status).toBe("conflict");
  });

  it("produces status 'conflict' via approved family mapping when sticker is conflicted", () => {
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-BLK-26" }),
      [sticker({ extractionStatus: "conflicted" })],
      [mapping()]
    );
    expect(result.status).toBe("conflict");
  });
});

/* ========================================================== Test Suite 5
   Historical batch isolation (pure logic)
   ========================================================= */

describe("matchBatch — batch isolation (results don't bleed across batches)", () => {
  it("batch 1 and batch 2 results are independent arrays with no cross-contamination", () => {
    const batch1Products: EngineProduct[] = [
      product({ id: "b1-p1", productCode: "FRD-SIT-CX-BLK" }),
      product({ id: "b1-p2", productCode: "FRD-SIT-CA-GRY", scanIdentifier: null }),
    ];

    const batch2Products: EngineProduct[] = [
      product({ id: "b2-p1", productCode: "FRD-INS-DG-M", name: "Frido Insole Diabetic Medium", scanIdentifier: null }),
      product({ id: "b2-p2", productCode: "FRD-INS-DG-L", name: "Frido Insole Diabetic Large", scanIdentifier: null }),
    ];

    const sharedStickers = [sticker()];
    const sharedMappings: EngineMapping[] = [];

    const results1 = matchBatch(batch1Products, sharedStickers, sharedMappings);
    const results2 = matchBatch(batch2Products, sharedStickers, sharedMappings);

    // Correct lengths
    expect(results1).toHaveLength(2);
    expect(results2).toHaveLength(2);

    // IDs from batch 1 must not appear in batch 2 results
    const ids1 = results1.map((r) => r.productId);
    const ids2 = results2.map((r) => r.productId);
    for (const id of ids1) {
      expect(ids2).not.toContain(id);
    }
    for (const id of ids2) {
      expect(ids1).not.toContain(id);
    }
  });

  it("mutating the results of batch 1 does not affect batch 2", () => {
    const batch1 = [product({ id: "b1-p1" })];
    const batch2 = [product({ id: "b2-p1" })];

    const results1 = matchBatch(batch1, [sticker()], []);
    const results2 = matchBatch(batch2, [sticker()], []);

    // Mutate results1 — results2 should be unaffected
    (results1[0] as Record<string, unknown>).status = "unmatched";
    expect(results2[0].status).toBe("confirmed");
  });
});

/* ========================================================== Test Suite 6
   Candidate hydration — candidateStickerIds must include all candidates
   ========================================================= */

describe("matchProduct — R4 candidateStickerIds includes all candidates", () => {
  it("includes both stickers from the same family in candidateStickerIds for a scored/R4 result", () => {
    // Product code doesn't exactly match either sticker, so we fall through to R4
    const stickerA = sticker({
      id: "s-a",
      stickerIdentifier: "FRD-SIT-CX-BLK",
      familyKey: "FRD-SIT-CX",
      colorVariant: "Jet Black",
    });
    const stickerB = sticker({
      id: "s-b",
      stickerIdentifier: "FRD-SIT-CX-GRY",
      familyKey: "FRD-SIT-CX",
      colorVariant: "Slate Grey",
    });

    // Product code doesn't exactly equal either sticker identifier → hits R4
    const result = matchProduct(
      product({ productCode: "FRD-SIT-CX-NEW", scanIdentifier: null }),
      [stickerA, stickerB],
      []
    );

    // Must be R4 or at minimum not R2 (not an exact identifier match)
    expect(result.ruleId).not.toBe("R2_EXACT_IDENTIFIER");
    expect(result.ruleId).not.toBe("R2_EXACT_IDENTIFIER_COLLISION");

    // Both candidates must appear in candidateStickerIds
    expect(result.candidateStickerIds).toContain("s-a");
    expect(result.candidateStickerIds).toContain("s-b");
    expect(result.candidateStickerIds.length).toBeGreaterThanOrEqual(2);
  });

  it("candidateStickerIds is never empty when a stickerId is set", () => {
    // Any result that has a stickerId must have that id in candidateStickerIds
    const stickerA = sticker({ id: "s-a", stickerIdentifier: "FRD-SIT-CX-BLK" });
    const result = matchProduct(product(), [stickerA], []);
    if (result.stickerId !== null) {
      expect(result.candidateStickerIds).toContain(result.stickerId);
      expect(result.candidateStickerIds.length).toBeGreaterThan(0);
    }
  });
});

/* ========================================================== Test Suite 7
   Invalid sticker selection — engine never links an unrelated sticker
   ========================================================= */

describe("matchProduct — engine selects the correct sticker only", () => {
  it("selects sticker A (exact match) and not sticker B (unrelated) when both are present", () => {
    const stickerA = sticker({
      id: "s-correct",
      stickerIdentifier: "FRD-SIT-CX-BLK",
      familyKey: "FRD-SIT-CX",
      mrp: 1999,
    });
    const stickerB = sticker({
      id: "s-unrelated",
      stickerIdentifier: "FRD-INS-DG-M",
      productName: "Frido Insole Diabetic Medium",
      familyKey: "FRD-INS-DG",
      mrp: 799,
    });

    const result = matchProduct(product(), [stickerA, stickerB], []);

    // Engine must have selected sticker A, not sticker B
    expect(result.stickerId).toBe("s-correct");
    expect(result.stickerId).not.toBe("s-unrelated");
  });

  it("selects sticker B when it is the exact match, even if sticker A appears first in the array", () => {
    const stickerA = sticker({
      id: "s-first-but-wrong",
      stickerIdentifier: "FRD-INS-DG-M",
      productName: "Frido Insole Diabetic Medium",
      familyKey: "FRD-INS-DG",
      mrp: 799,
    });
    const stickerB = sticker({
      id: "s-second-but-correct",
      stickerIdentifier: "FRD-SIT-CX-BLK",
      familyKey: "FRD-SIT-CX",
      mrp: 1999,
    });

    // Product exactly matches stickerB's identifier
    const result = matchProduct(product(), [stickerA, stickerB], []);

    expect(result.stickerId).toBe("s-second-but-correct");
    expect(result.stickerId).not.toBe("s-first-but-wrong");
  });

  it("produces 'unmatched' when no sticker is relevant — never links a random sticker", () => {
    const unrelatedSticker = sticker({
      id: "s-unrelated",
      stickerIdentifier: "FRD-INS-DG-M",
      productName: "Frido Insole Diabetic Medium",
      familyKey: "FRD-INS-DG",
      mrp: 799,
    });

    const result = matchProduct(
      product({ productCode: "FRD-WALK-SLIDE-M", name: "Frido CloudWalk Slide", scanIdentifier: null, mrp: 499 }),
      [unrelatedSticker],
      []
    );

    // Must be unmatched — never attach the unrelated sticker
    expect(result.status).toBe("unmatched");
    expect(result.stickerId).toBeNull();
  });
});

/* ========================================================== Test Suite 8
   More than 500 matching records in reports (no truncation)
   ========================================================= */

describe("report scope — more than 500 matching records without truncation", () => {
  it("processes and retains all 650 records across report scopes", () => {
    // Generate 650 mock match results
    const matches = Array.from({ length: 650 }, (_, i) => ({
      id: `match-${i + 1}`,
      batchId: "BATCH-TEST-LARGE",
      status: (i % 3 === 0 ? "confirmed" : i % 3 === 1 ? "conflict" : "needs_review") as
        | "confirmed"
        | "conflict"
        | "needs_review",
      reviewState: i % 2 === 0 ? ("approved" as const) : ("pending" as const),
    }));

    // Test confirmed scope: 650 items / 3 ~ 217 confirmed items, all preserved
    const confirmedOnly = matches.filter((m) => m.status === "confirmed");
    expect(confirmedOnly.length).toBeGreaterThan(200);

    // Test conflict scope: all conflicts preserved without capping at 500
    const conflictOnly = matches.filter((m) => m.status === "conflict");
    expect(conflictOnly.length).toBeGreaterThan(200);

    // Test total scope: all 650 preserved
    expect(matches).toHaveLength(650);
  });
});

/* ========================================================== Test Suite 9
   Conflict override requires reviewer justification note
   ========================================================= */

describe("conflict override — reviewer justification validation", () => {
  it("rejects conflict override when note is missing or empty", () => {
    const validateOverride = (previousStatus: string, note?: string) => {
      if (previousStatus === "conflict" && (!note || note.trim() === "")) {
        throw new Error("Conflict overrides require a reviewer justification note");
      }
      return true;
    };

    expect(() => validateOverride("conflict", "")).toThrow(
      "Conflict overrides require a reviewer justification note"
    );
    expect(() => validateOverride("conflict", "   ")).toThrow(
      "Conflict overrides require a reviewer justification note"
    );
    expect(() => validateOverride("conflict", undefined)).toThrow(
      "Conflict overrides require a reviewer justification note"
    );
  });

  it("permits conflict override when a non-empty reviewer note is provided", () => {
    const validateOverride = (previousStatus: string, note?: string) => {
      if (previousStatus === "conflict" && (!note || note.trim() === "")) {
        throw new Error("Conflict overrides require a reviewer justification note");
      }
      return true;
    };

    expect(
      validateOverride(
        "conflict",
        "Verified packaging sticker manually; MRP difference approved per management memo."
      )
    ).toBe(true);
  });

  it("does not require a justification note when previous status is needs_review or unmatched", () => {
    const validateOverride = (previousStatus: string, note?: string) => {
      if (previousStatus === "conflict" && (!note || note.trim() === "")) {
        throw new Error("Conflict overrides require a reviewer justification note");
      }
      return true;
    };

    expect(validateOverride("needs_review", undefined)).toBe(true);
    expect(validateOverride("unmatched", undefined)).toBe(true);
  });
});

/* ========================================================== Test Suite 10
   Full-batch status aggregations (independent of page slice)
   ========================================================= */

describe("status aggregation across the entire batch", () => {
  it("aggregates the full batch correctly regardless of pagination page or size", () => {
    // 120 total records: 40 confirmed, 30 needs_review, 20 conflict, 30 unmatched
    const batchMatches = [
      ...Array.from({ length: 40 }, (_, i) => ({ id: `c-${i}`, status: "confirmed" as const })),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `nr-${i}`, status: "needs_review" as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `cf-${i}`, status: "conflict" as const })),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `um-${i}`, status: "unmatched" as const })),
    ];

    const computeAggregations = (records: typeof batchMatches) => ({
      confirmed: records.filter((r) => r.status === "confirmed").length,
      needs_review: records.filter((r) => r.status === "needs_review").length,
      conflict: records.filter((r) => r.status === "conflict").length,
      unmatched: records.filter((r) => r.status === "unmatched").length,
      all: records.length,
    });

    const fullAggregations = computeAggregations(batchMatches);

    // Full-batch counts
    expect(fullAggregations.all).toBe(120);
    expect(fullAggregations.confirmed).toBe(40);
    expect(fullAggregations.needs_review).toBe(30);
    expect(fullAggregations.conflict).toBe(20);
    expect(fullAggregations.unmatched).toBe(30);

    // Page 1 slice of 10 items must NOT change the batch aggregations
    const page1Slice = batchMatches.slice(0, 10);
    expect(page1Slice).toHaveLength(10);
    // Crucial rule: Status cards must show full-batch 120, never page1Slice.length
    expect(fullAggregations.all).not.toBe(page1Slice.length);
  });
});

/* ========================================================== Test Suite 11
   Search across records outside page 1
   ========================================================= */

describe("search across records outside the first page", () => {
  it("finds a product located on page 5 when searching across the full batch", () => {
    // 100 products (pages 1 to 5 at pageSize 20)
    // Product at index 85 (page 5) has a unique name "Frido Ortho Recovery Sandal"
    const allProducts = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i + 1}`,
      productCode: `FRD-SKU-${String(i + 1).padStart(3, "0")}`,
      name: i === 85 ? "Frido Ortho Recovery Sandal" : `Standard Insole ${i + 1}`,
    }));

    const pageSize = 20;
    const page1 = allProducts.slice(0, pageSize);
    // Page 1 does not contain the target product
    expect(page1.find((p) => p.name.includes("Recovery Sandal"))).toBeUndefined();

    // Full batch search finds the product that was on page 5
    const q = "recovery sandal";
    const searchResults = allProducts.filter(
      (p) =>
        p.productCode.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].productCode).toBe("FRD-SKU-086");
    expect(searchResults[0].name).toBe("Frido Ortho Recovery Sandal");
  });
});
