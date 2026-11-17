import { describe, expect, it } from "vitest";
import { CsvStructureError, buildErrorReportCsv, parseItemMasterCsv } from "@/lib/csv";

const HEADER =
  "Product Code,Name,Description,Brand,Color,Size,MRP,Scan Identifier,Catalog Category Full Name,Extra Column";

describe("parseItemMasterCsv", () => {
  it("parses a normal Item Master file and preserves source columns", () => {
    const csv = `${HEADER}\nFRD-1,Frido Cushion,Memory foam,Frido,Black,Standard,1999,8901,Frido > Sit,keep-me`;
    const parsed = parseItemMasterCsv(csv, "normal.csv");

    expect(parsed.totalRows).toBe(1);
    expect(parsed.validRows).toBe(1);
    expect(parsed.invalidRows).toBe(0);
    expect(parsed.rows[0].data.productCode).toBe("FRD-1");
    expect(parsed.rows[0].data.mrp).toBe(1999);
    expect(parsed.rows[0].raw["Extra Column"]).toBe("keep-me");
    expect(parsed.unknownColumns).toContain("Extra Column");
  });

  it("strips a UTF-8 BOM before header detection", () => {
    const csv = `\uFEFF${HEADER}\nFRD-1,Frido Cushion,Desc,Frido,Black,Standard,1999,8901,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "bom.csv");
    expect(parsed.validRows).toBe(1);
    expect(parsed.rows[0].data.productCode).toBe("FRD-1");
  });

  it("supports quoted commas inside values", () => {
    const csv = `${HEADER}\nFRD-1,"Frido Cushion, Large",Desc,Frido,Black,Standard,1999,8901,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "commas.csv");
    expect(parsed.rows[0].data.name).toBe("Frido Cushion, Large");
  });

  it("supports quoted multiline values", () => {
    const csv = `${HEADER}\nFRD-1,Frido Cushion,"Line one\nLine two",Frido,Black,Standard,1999,8901,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "multiline.csv");
    expect(parsed.totalRows).toBe(1);
    expect(parsed.rows[0].data.description).toContain("Line two");
  });

  it("rejects duplicate product codes so a product cannot match twice", () => {
    const csv = `${HEADER}\nFRD-1,Name A,Desc,Frido,Black,S,1999,1,Cat,x\nFRD-1,Name B,Desc,Frido,Black,S,1999,2,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "dupes.csv");
    expect(parsed.duplicateProductCodes).toEqual(["FRD-1"]);
    expect(parsed.invalidRows).toBe(2);
    expect(parsed.validRows).toBe(0);
    expect(parsed.rows.every((row) => row.issues.some((issue) => issue.includes("Duplicate")))).toBe(true);
  });

  it("rejects invalid and missing MRP values", () => {
    const csv = `${HEADER}\nFRD-1,Name,Desc,Frido,Black,S,abc,1,Cat,x\nFRD-2,Name,Desc,Frido,Black,S,,2,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "mrp.csv");
    expect(parsed.invalidRows).toBe(2);
    expect(parsed.rows[0].issues.join(" ")).toContain("Invalid");
    expect(parsed.rows[1].issues.join(" ")).toContain("Missing MRP");
  });

  it("throws a structural error when a required column is missing", () => {
    const csv = "Product Code,Description\nFRD-1,Desc";
    expect(() => parseItemMasterCsv(csv, "missing.csv")).toThrowError(CsvStructureError);
    try {
      parseItemMasterCsv(csv, "missing.csv");
    } catch (error) {
      const structural = error as CsvStructureError;
      expect(structural.missingRequiredColumns).toEqual(["Name", "MRP"]);
    }
  });

  it("throws for empty files and header-only files", () => {
    expect(() => parseItemMasterCsv("", "empty.csv")).toThrowError(CsvStructureError);
    expect(() => parseItemMasterCsv(HEADER, "header-only.csv")).toThrowError(CsvStructureError);
  });

  it("produces a downloadable error report for rejected rows", () => {
    const csv = `${HEADER}\nFRD-1,Name,Desc,Frido,Black,S,not-a-price,1,Cat,x`;
    const parsed = parseItemMasterCsv(csv, "errors.csv");
    const report = buildErrorReportCsv(parsed);
    expect(report).toContain("Row Number");
    expect(report).toContain("FRD-1");
    expect(report).toContain("Invalid numeric");
  });
});
