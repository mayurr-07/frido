import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfMatchRow = {
  productCode: string;
  productName: string;
  mrp: number | null;
  stickerIdentifier: string | null;
  status: string;
  ruleId: string;
  evidence: string;
  reviewerNote: string | null;
  reviewedBy: string | null;
};

export type PdfBatchSummary = {
  batchCode: string;
  filename: string;
  uploadedAt: Date;
  processedAt: Date;
  uploadedBy: string;
  engineVersion: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  confirmed: number;
  needsReview: number;
  conflicts: number;
  unmatched: number;
};

export type ReportPdfInput = {
  reportCode: string;
  reportType: string;
  generatedAt: Date;
  generatedByName: string;
  batch: PdfBatchSummary;
  rows: PdfMatchRow[];
};

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const FOOTER_HEIGHT = 34;

const COLORS = {
  charcoal: rgb(0.09, 0.09, 0.09),
  muted: rgb(0.42, 0.42, 0.42),
  border: rgb(0.89, 0.89, 0.88),
  yellow: rgb(0.988, 0.82, 0.047),
  green: rgb(0.086, 0.514, 0.29),
  amber: rgb(0.851, 0.604, 0.086),
  red: rgb(0.863, 0.271, 0.271),
  grey: rgb(0.573, 0.573, 0.573),
  surface: rgb(0.98, 0.98, 0.975),
};

const REPORT_TITLES: Record<string, string> = {
  approved_only: "Approved Matches Report",
  complete_report: "Complete Matching Report",
  batch_summary: "Batch Summary Report",
  conflict_report: "Conflict Report",
  review_report: "Manual Review Report",
};

function statusColor(status: string) {
  if (status === "confirmed") return COLORS.green;
  if (status === "needs_review") return COLORS.amber;
  if (status === "conflict") return COLORS.red;
  return COLORS.grey;
}

/** Standard PDF fonts use WinAnsi: normalise characters Helvetica cannot encode. */
function sanitize(text: string): string {
  return text
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "-");
}

function truncate(rawText: string, font: PDFFont, size: number, maxWidth: number): string {
  const text = sanitize(rawText);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`${input.reportCode} — Frido Prize Sticker Matching`);
  doc.setAuthor("Frido Product Intelligence Platform");
  doc.setSubject(REPORT_TITLES[input.reportType] ?? "Matching Report");

  const columns = [
    { key: "code", label: "Product Code", width: 92 },
    { key: "product", label: "Product", width: 128 },
    { key: "sticker", label: "Sticker Ref", width: 86 },
    { key: "mrp", label: "MRP", width: 48 },
    { key: "status", label: "Status", width: 58 },
    { key: "evidence", label: "Rule / Evidence", width: 103 },
  ] as const;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const drawFooter = (target: PDFPage) => {
    const pageIndex = doc.getPageCount();
    target.drawLine({
      start: { x: MARGIN, y: FOOTER_HEIGHT + 14 },
      end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_HEIGHT + 14 },
      thickness: 0.6,
      color: COLORS.border,
    });
    target.drawText(sanitize(`Frido Product Intelligence — ${input.reportCode}`), {
      x: MARGIN,
      y: FOOTER_HEIGHT - 2,
      size: 7.5,
      font,
      color: COLORS.muted,
    });
    const label = `Page ${pageIndex}`;
    target.drawText(label, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 7.5),
      y: FOOTER_HEIGHT - 2,
      size: 7.5,
      font,
      color: COLORS.muted,
    });
  };

  const newPage = () => {
    drawFooter(page);
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < FOOTER_HEIGHT + 26) newPage();
  };

  /* ------------------------------------------------------------ letterhead */
  page.drawRectangle({ x: MARGIN, y: cursorY - 34, width: 64, height: 34, color: COLORS.yellow });
  page.drawText("Frido", {
    x: MARGIN + 9,
    y: cursorY - 24,
    size: 19,
    font: bold,
    color: COLORS.charcoal,
  });
  page.drawText("PRODUCT INTELLIGENCE", {
    x: MARGIN + 76,
    y: cursorY - 14,
    size: 8,
    font: bold,
    color: COLORS.muted,
  });
  page.drawText(REPORT_TITLES[input.reportType] ?? "Matching Report", {
    x: MARGIN + 76,
    y: cursorY - 28,
    size: 15,
    font: bold,
    color: COLORS.charcoal,
  });

  const metaLine1 = `${input.reportCode}  ·  Batch ${input.batch.batchCode}`;
  const metaLine2 = `Generated ${formatDate(input.generatedAt)} by ${input.generatedByName}`;
  page.drawText(sanitize(metaLine1), {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(metaLine1, 8),
    y: cursorY - 16,
    size: 8,
    font,
    color: COLORS.muted,
  });
  page.drawText(sanitize(metaLine2), {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(metaLine2, 8),
    y: cursorY - 28,
    size: 8,
    font,
    color: COLORS.muted,
  });

  cursorY -= 48;
  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
    thickness: 1.2,
    color: COLORS.charcoal,
  });
  cursorY -= 18;

  /* --------------------------------------------------------- batch details */
  const detailRows: Array<[string, string]> = [
    ["Original filename", input.batch.filename],
    ["Uploaded by", input.batch.uploadedBy],
    ["Uploaded", formatDate(input.batch.uploadedAt)],
    ["Processed", formatDate(input.batch.processedAt)],
    ["Matching engine", input.batch.engineVersion],
    ["Rows", `${input.batch.totalRows} total · ${input.batch.validRows} valid · ${input.batch.invalidRows} invalid`],
  ];
  for (const [label, value] of detailRows) {
    ensureSpace(14);
    page.drawText(label, { x: MARGIN, y: cursorY, size: 8.5, font: bold, color: COLORS.muted });
    page.drawText(truncate(value, font, 8.5, tableWidth - 120), {
      x: MARGIN + 120,
      y: cursorY,
      size: 8.5,
      font,
      color: COLORS.charcoal,
    });
    cursorY -= 13;
  }

  cursorY -= 10;

  /* ------------------------------------------------------- summary blocks */
  ensureSpace(58);
  const blocks: Array<{ label: string; value: number; color: typeof COLORS.green }> = [
    { label: "Confirmed", value: input.batch.confirmed, color: COLORS.green },
    { label: "Needs Review", value: input.batch.needsReview, color: COLORS.amber },
    { label: "Conflicts", value: input.batch.conflicts, color: COLORS.red },
    { label: "Unmatched", value: input.batch.unmatched, color: COLORS.grey },
  ];
  const blockWidth = (tableWidth - 24) / 4;
  blocks.forEach((block, index) => {
    const x = MARGIN + index * (blockWidth + 8);
    page.drawRectangle({
      x,
      y: cursorY - 42,
      width: blockWidth,
      height: 42,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 0.6,
    });
    page.drawRectangle({ x, y: cursorY - 42, width: 3, height: 42, color: block.color });
    page.drawText(block.label, { x: x + 9, y: cursorY - 15, size: 7.5, font, color: COLORS.muted });
    page.drawText(String(block.value), {
      x: x + 9,
      y: cursorY - 34,
      size: 16,
      font: bold,
      color: COLORS.charcoal,
    });
  });
  cursorY -= 60;

  /* ---------------------------------------------------------- table header */
  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 4,
      width: tableWidth,
      height: 18,
      color: COLORS.charcoal,
    });
    let x = MARGIN + 5;
    for (const column of columns) {
      page.drawText(column.label, {
        x,
        y: cursorY + 2,
        size: 7.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    }
    cursorY -= 20;
  };

  const sectionLabel =
    input.reportType === "approved_only"
      ? "Approved product mappings"
      : input.reportType === "conflict_report"
      ? "Conflicting products"
      : input.reportType === "review_report"
      ? "Manual review items"
      : "Product matching detail";
  ensureSpace(30);
  page.drawText(`${sectionLabel} (${input.rows.length})`, {
    x: MARGIN,
    y: cursorY,
    size: 9,
    font: bold,
    color: COLORS.charcoal,
  });
  cursorY -= 16;
  drawTableHeader();

  /* ------------------------------------------------------------ table rows */
  input.rows.forEach((row, rowIndex) => {
    if (cursorY < FOOTER_HEIGHT + 46) {
      newPage();
      drawTableHeader();
    }
    const height = 22;
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - 6,
        width: tableWidth,
        height,
        color: COLORS.surface,
      });
    }
    const ruleSnippet = `${row.ruleId.split("_")[0]} · ${row.evidence}`;
    const values: Record<string, string> = {
      code: row.productCode,
      product: row.productName,
      sticker: row.stickerIdentifier ?? "—",
      mrp: row.mrp !== null ? `₹${row.mrp.toLocaleString("en-IN")}` : "—",
      status: row.status.replace(/_/g, " "),
      evidence: ruleSnippet,
    };
    let x = MARGIN + 5;
    for (const column of columns) {
      const value = truncate(values[column.key] ?? "", font, 7.2, column.width - 8);
      page.drawText(value, {
        x,
        y: cursorY + 3,
        size: 7.2,
        font: column.key === "status" ? bold : font,
        color: column.key === "status" ? statusColor(row.status) : COLORS.charcoal,
      });
      x += column.width;
    }
    if (row.reviewerNote) {
      page.drawText(truncate(`Reviewer note: ${row.reviewerNote}`, font, 6.6, tableWidth - 10), {
        x: MARGIN + 5,
        y: cursorY - 3,
        size: 6.6,
        font,
        color: COLORS.muted,
      });
    }
    cursorY -= height + (row.reviewerNote ? 6 : 0);
    page.drawLine({
      start: { x: MARGIN, y: cursorY + 8 },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY + 8 },
      thickness: 0.4,
      color: COLORS.border,
    });
  });

  if (input.rows.length === 0) {
    ensureSpace(30);
    page.drawText("No records matched this report scope.", {
      x: MARGIN,
      y: cursorY,
      size: 9,
      font,
      color: COLORS.muted,
    });
    cursorY -= 20;
  }

  /* ------------------------------------------------------------- signature */
  ensureSpace(64);
  cursorY -= 14;
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 38,
    width: tableWidth,
    height: 38,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 0.6,
  });
  page.drawText("Matching decisions remain auditable in the Frido platform.", {
    x: MARGIN + 9,
    y: cursorY - 15,
    size: 7.6,
    font: bold,
    color: COLORS.charcoal,
  });
  page.drawText(
    truncate(
      `This document was generated by matching engine ${input.batch.engineVersion}. Products without verified evidence are never auto-confirmed.`,
      font,
      7,
      tableWidth - 18
    ),
    { x: MARGIN + 9, y: cursorY - 28, size: 7, font, color: COLORS.muted }
  );
  cursorY -= 48;

  drawFooter(page);
  return doc.save();
}
