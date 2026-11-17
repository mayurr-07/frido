import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateReportPdf, type PdfMatchRow } from "@/server/reports/pdf";

const batch = {
  batchCode: "BATCH-TEST-001",
  filename: "Frido_ItemMaster_Test.csv",
  uploadedAt: new Date("2026-04-08T09:12:00Z"),
  processedAt: new Date("2026-04-08T09:14:00Z"),
  uploadedBy: "QA Engineer",
  engineVersion: "2.0.0",
  totalRows: 60,
  validRows: 58,
  invalidRows: 2,
  confirmed: 40,
  needsReview: 10,
  conflicts: 5,
  unmatched: 3,
};

const row = (index: number): PdfMatchRow => ({
  productCode: `FRD-SIT-CX-BLK-${index}`,
  productName:
    "Frido Ultimate Ergonomic Coccyx Seat Cushion - Black (Extra Long Product Name That Must Truncate Cleanly Without Overlapping Adjacent Cells)",
  mrp: 1999,
  stickerIdentifier: "FRD-SIT-CX-BLK",
  status: index % 3 === 0 ? "confirmed" : index % 3 === 1 ? "needs_review" : "conflict",
  ruleId: "R2_EXACT_IDENTIFIER",
  evidence: "Exact identifier match",
  reviewerNote: index === 0 ? "Verified against the printed sticker artwork." : null,
  reviewedBy: index === 0 ? "Aarav Mehta" : null,
});

describe("report PDF generation", () => {
  it("produces a valid, downloadable single-page PDF", async () => {
    const bytes = await generateReportPdf({
      reportCode: "RPT-TEST-001",
      reportType: "complete_report",
      generatedAt: new Date("2026-11-17T10:00:00Z"),
      generatedByName: "QA Engineer",
      batch,
      rows: [row(0), row(1)],
    });

    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain("RPT-TEST-001");
  });

  it("paginates long tables with repeated headers and page numbers", async () => {
    const bytes = await generateReportPdf({
      reportCode: "RPT-TEST-002",
      reportType: "complete_report",
      generatedAt: new Date("2026-11-17T10:00:00Z"),
      generatedByName: "QA Engineer",
      batch: { ...batch, totalRows: 60 },
      rows: Array.from({ length: 60 }, (_, index) => row(index)),
    });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });

  it("renders an empty scope without failing", async () => {
    const bytes = await generateReportPdf({
      reportCode: "RPT-TEST-003",
      reportType: "approved_only",
      generatedAt: new Date(),
      generatedByName: "QA Engineer",
      batch,
      rows: [],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("handles non-WinAnsi characters without throwing", async () => {
    const bytes = await generateReportPdf({
      reportCode: "RPT-TEST-004",
      reportType: "conflict_report",
      generatedAt: new Date(),
      generatedByName: 'Aarav "QA" Mehta',
      batch,
      rows: [{ ...row(0), reviewerNote: "MRP Rs.1,999 - verified" }],
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
