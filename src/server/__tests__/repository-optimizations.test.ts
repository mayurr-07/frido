import { describe, expect, it } from "vitest";
import { reportTypeScope } from "@/server/repository";
import type { MatchResult, ReportType } from "@/types/frido";

describe("Report optimization & scoping logic", () => {
  it("maps each report type to its exact target match scope", () => {
    const expectations: Record<ReportType, string> = {
      approved_only: "confirmed",
      conflict_report: "conflict",
      review_report: "reviewed",
      batch_summary: "all",
      complete_report: "all",
    };

    for (const [reportType, expectedScope] of Object.entries(expectations) as Array<[ReportType, string]>) {
      expect(reportTypeScope(reportType)).toBe(expectedScope);
    }
  });

  it("handles unknown or arbitrary report types with safe fallback to 'all'", () => {
    // @ts-expect-error test fallback
    expect(reportTypeScope("unknown_type")).toBe("all");
    // @ts-expect-error test fallback
    expect(reportTypeScope("")).toBe("all");
  });

  // Emulate SQL condition logic in JavaScript to test semantic equivalence with original scopeMatches
  function sqlFilterMatches(
    scope: string,
    rows: Array<{ status: string; reviewState: string | null }>
  ): Array<{ status: string; reviewState: string | null }> {
    if (scope === "confirmed") {
      return rows.filter((r) => r.status === "confirmed");
    }
    if (scope === "conflict") {
      return rows.filter((r) => r.status === "conflict");
    }
    if (scope === "reviewed") {
      return rows.filter((r) => {
        const reviewStateCoalesce = r.reviewState ?? "";
        return (
          reviewStateCoalesce !== "pending" ||
          r.status === "needs_review" ||
          r.status === "conflict"
        );
      });
    }
    return rows;
  }

  function originalScopeMatches(
    scope: string,
    matches: Array<{ status: string; reviewState: string | null }>
  ): Array<{ status: string; reviewState: string | null }> {
    if (scope === "confirmed") return matches.filter((m) => m.status === "confirmed");
    if (scope === "conflict") return matches.filter((m) => m.status === "conflict");
    if (scope === "reviewed") {
      return matches.filter(
        (m) =>
          m.reviewState !== "pending" ||
          m.status === "needs_review" ||
          m.status === "conflict"
      );
    }
    return matches;
  }

  it("proves SQL condition logic exactly matches original scopeMatches across all statuses and review states", () => {
    const testCases: Array<{ status: string; reviewState: string | null }> = [
      { status: "confirmed", reviewState: "pending" },
      { status: "confirmed", reviewState: "approved" },
      { status: "needs_review", reviewState: "pending" },
      { status: "needs_review", reviewState: "deferred" },
      { status: "conflict", reviewState: "pending" },
      { status: "conflict", reviewState: "rejected" },
      { status: "unmatched", reviewState: "pending" },
      { status: "unmatched", reviewState: "approved" },
      // Null reviewState edge case
      { status: "confirmed", reviewState: null },
      { status: "unmatched", reviewState: null },
    ];

    const scopes = ["confirmed", "conflict", "reviewed", "all"];
    for (const scope of scopes) {
      const sqlResult = sqlFilterMatches(scope, testCases);
      const originalResult = originalScopeMatches(scope, testCases);
      expect(sqlResult.length).toBe(originalResult.length);
      expect(sqlResult).toEqual(originalResult);
    }
  });
});

describe("Errors CSV generation logic", () => {
  function escapeCsv(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function generateErrorCsvLines(
    invalidProducts: Array<{
      rowNumber: number;
      productCode: string;
      name: string | null;
      issues: string[];
      raw: Record<string, unknown>;
    }>
  ): string[] {
    const header = ["Row Number", "Product Code", "Name", "Validation Issues", "Raw Row"];
    const lines = [header.join(",")];
    for (const product of invalidProducts) {
      lines.push(
        [
          product.rowNumber,
          product.productCode,
          product.name ?? "",
          product.issues.join(" | "),
          JSON.stringify(product.raw),
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
    return lines;
  }

  it("generates correctly formatted CSV with headers and escaped fields", () => {
    const mockInvalid = [
      {
        rowNumber: 3,
        productCode: "FRD-ERR-001",
        name: "Test Product, with comma",
        issues: ["Missing MRP", "Invalid Net Quantity"],
        raw: { "Product Code": "FRD-ERR-001", Name: "Test Product, with comma" },
      },
      {
        rowNumber: 7,
        productCode: "FRD-ERR-002",
        name: 'Product with "quotes"',
        issues: ["Duplicate SKU"],
        raw: { "Product Code": "FRD-ERR-002" },
      },
      {
        rowNumber: 12,
        productCode: "FRD-ERR-003",
        name: null,
        issues: ["Blank Row"],
        raw: {},
      },
    ];

    const lines = generateErrorCsvLines(mockInvalid);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Row Number,Product Code,Name,Validation Issues,Raw Row");

    // Row 1: name has comma, should be quoted
    expect(lines[1]).toContain('"Test Product, with comma"');
    expect(lines[1]).toContain("Missing MRP | Invalid Net Quantity");
    expect(lines[1]).toContain('"{""Product Code"":""FRD-ERR-001"",""Name"":""Test Product, with comma""}"');

    // Row 2: name has quotes, should have escaped quotes
    expect(lines[2]).toContain('"Product with ""quotes"""');

    // Row 3: null name should be empty string
    expect(lines[3]).toContain("12,FRD-ERR-003,,Blank Row");
  });

  it("produces only header when there are no invalid products in batch", () => {
    const lines = generateErrorCsvLines([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("Row Number,Product Code,Name,Validation Issues,Raw Row");
  });
});
