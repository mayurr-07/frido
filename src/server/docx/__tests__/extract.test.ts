import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractStickerFromDocx, parseMrp } from "@/server/docx/extract";

/** Build a genuine minimal .docx (zip + word/document.xml) so mammoth parses it for real. */
async function buildDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = (rows: string[][]) =>
  `<w:tbl>${rows
    .map(
      (row) =>
        `<w:tr>${row
          .map((cell) => `<w:tc><w:tcPr/><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`)
          .join("")}</w:tr>`
    )
    .join("")}</w:tbl>`;

describe("parseMrp", () => {
  it("extracts Indian MRP formats", () => {
    expect(parseMrp("MRP: ₹1,999.00 (Incl. of all taxes)")).toBe(1999);
    expect(parseMrp("Rs. 799")).toBe(799);
    expect(parseMrp("not a price")).toBeNull();
    expect(parseMrp(null)).toBeNull();
  });
});

describe("extractStickerFromDocx", () => {
  it("extracts sticker fields from a real Word table", async () => {
    const buffer = await buildDocx(
      table([
        ["Sticker Identifier", "FRD-SIT-CX-BLK"],
        ["Product Name", "Frido Ultimate Coccyx Cushion - Black"],
        ["Common Name", "Memory Foam Seat Cushion"],
        ["Net Quantity", "1 Unit"],
        ["Dimensions", "45.0 cm × 36.0 cm × 8.0 cm"],
        ["Colour", "Jet Black"],
        ["Size Variant", "Standard"],
        ["Manufacturing Month/Year", "03/2026"],
        ["Batch Number", "B-2026-03"],
        ["Marketed By", "Arcatron Mobility Pvt Ltd"],
        ["Country of Origin", "India"],
        ["MRP", "₹1,999"],
        ["Customer Care", "care@myfrido.com"],
      ])
    );

    const result = await extractStickerFromDocx(buffer, "FRD-SIT-CX-BLK.docx");
    expect(result.stickerIdentifier).toBe("FRD-SIT-CX-BLK");
    expect(result.productName).toContain("Coccyx Cushion");
    expect(result.commonName).toBe("Memory Foam Seat Cushion");
    expect(result.netQuantity).toBe("1 Unit");
    expect(result.dimensions).toContain("45.0 cm");
    expect(result.colorVariant).toBe("Jet Black");
    expect(result.sizeVariant).toBe("Standard");
    expect(result.manufacturingMonthYear).toBe("03/2026");
    expect(result.batchNumber).toBe("B-2026-03");
    expect(result.marketedBy).toContain("Arcatron");
    expect(result.countryOfOrigin).toBe("India");
    expect(result.mrp).toBe(1999);
    expect(result.customerCare).toContain("care@myfrido.com");
    expect(result.extractionStatus).toBe("extracted");
  });

  it("never invents colour or size when the document omits them", async () => {
    const buffer = await buildDocx(
      table([
        ["Product Name", "Frido Dual Gel Insoles - Medium"],
        ["Net Quantity", "1 Pair"],
        ["Dimensions", "27.5 cm × 9.2 cm × 1.4 cm"],
        ["MRP", "₹799"],
        ["Packaged & Marketed By", "Arcatron Mobility Pvt Ltd"],
      ]) + p("Sticker Identifier: FRD-INS-DG-M")
    );

    const result = await extractStickerFromDocx(buffer, "FRD-INS-DG-M.docx");
    expect(result.stickerIdentifier).toBe("FRD-INS-DG-M");
    expect(result.colorVariant).toBeNull();
    expect(result.sizeVariant).toBeNull();
    expect(result.extractionStatus).toBe("extracted");
  });

  it("flags missing fields instead of guessing", async () => {
    const buffer = await buildDocx(p("Sticker Identifier: FRD-INS-SP-L"));
    const result = await extractStickerFromDocx(buffer, "FRD-INS-SP-L.docx");
    expect(result.missingFields).toContain("Product Name");
    expect(result.missingFields).toContain("MRP");
    expect(result.extractionStatus).toBe("needs_attention");
    expect(result.extractionNote).toContain("Missing critical field(s)");
  });

  it("flags contradictory MRP values rather than choosing one", async () => {
    const buffer = await buildDocx(
      table([
        ["Product Name", "Frido Ultimate Wedge Pillow"],
        ["Net Quantity", "1 Unit"],
        ["Dimensions", "61.0 cm × 61.0 cm × 25.4 cm"],
        ["MRP", "₹3,299"],
      ]) + p("MRP: ₹3,599")
    );

    const result = await extractStickerFromDocx(buffer, "FRD-SLP-WDG-10.docx");
    expect(result.extractionStatus).toBe("needs_attention");
    expect(result.extractionNote).toContain("Multiple different MRP");
  });

  it("reports malformed documents as an extraction error", async () => {
    await expect(extractStickerFromDocx(Buffer.from("not a docx"), "broken.docx")).rejects.toBeTruthy();
  });

  // ---------------------------------------------------------------- regression tests
  // Packaged & Marketed By is informational: its absence must NOT block extraction.

  it("extracts successfully when Packaged & Marketed By is present", async () => {
    const buffer = await buildDocx(
      table([
        ["Sticker Identifier", "FRD-INS-DG-M"],
        ["Product Name", "Frido Dual Gel Insoles - Medium"],
        ["Net Quantity", "1 Pair"],
        ["Dimensions", "27.5 cm × 9.2 cm × 1.4 cm"],
        ["MRP", "₹799"],
        ["Packaged & Marketed By", "Arcatron Mobility Pvt Ltd"],
      ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-INS-DG-M.docx");
    expect(result.extractionStatus).toBe("extracted");
    expect(result.marketedBy).toBe("Arcatron Mobility Pvt Ltd");
    expect(result.missingFields).not.toContain("Packaged & Marketed By");
  });

  it("extracts successfully when Packaged & Marketed By is absent (informational only)", async () => {
    const buffer = await buildDocx(
      table([
        ["Sticker Identifier", "FRD-INS-SP-S"],
        ["Product Name", "Frido Sports Insoles - Small"],
        ["Net Quantity", "1 Pair"],
        ["Dimensions", "24.0 cm × 8.0 cm × 1.2 cm"],
        ["MRP", "₹699"],
      ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-INS-SP-S.docx");
    // Status must be extracted — missing Packaged & Marketed By is informational only.
    expect(result.extractionStatus).toBe("extracted");
    // The field still appears in missingFields so the UI can surface the warning.
    expect(result.missingFields).toContain("Packaged & Marketed By");
    // The extraction note records it as an informational warning, not a blocking error.
    expect(result.extractionNote).toContain("Informational warning");
    expect(result.extractionNote).not.toContain("Automatic confirmation is blocked");
  });

  it("flags needs_attention when MRP is missing (critical field)", async () => {
    const buffer = await buildDocx(
      table([
        ["Sticker Identifier", "FRD-SIT-MB-BLK"],
        ["Product Name", "Frido Memory Foam Back Cushion"],
        ["Net Quantity", "1 Unit"],
        // MRP intentionally omitted
        ["Packaged & Marketed By", "Arcatron Mobility Pvt Ltd"],
      ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-SIT-MB-BLK.docx");
    expect(result.extractionStatus).toBe("needs_attention");
    expect(result.missingFields).toContain("MRP");
    expect(result.extractionNote).toContain("Missing critical field(s)");
  });

  it("flags needs_attention when Sticker Identifier is missing (critical field)", async () => {
    const buffer = await buildDocx(
      table([
        ["Product Name", "Frido Lumbar Support Belt"],
        ["Net Quantity", "1 Unit"],
        ["MRP", "₹1,299"],
        ["Packaged & Marketed By", "Arcatron Mobility Pvt Ltd"],
      ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-LSB.docx");
    // No identifier in table or filename pattern → needs_attention
    expect(result.extractionStatus).toBe("needs_attention");
    expect(result.missingFields).toContain("Sticker Identifier");
  });

  it("flags needs_attention when Product Name is missing (critical field)", async () => {
    const buffer = await buildDocx(
      p("Sticker Identifier: FRD-SIT-WD-M") +
        table([
          ["MRP", "₹899"],
          ["Packaged & Marketed By", "Arcatron Mobility Pvt Ltd"],
        ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-SIT-WD-M.docx");
    expect(result.extractionStatus).toBe("needs_attention");
    expect(result.missingFields).toContain("Product Name");
    expect(result.extractionNote).toContain("Missing critical field(s)");
  });

  it("informational missing fields still appear in missingFields for UI display", async () => {
    const buffer = await buildDocx(
      table([
        ["Sticker Identifier", "FRD-SLP-NP-STD"],
        ["Product Name", "Frido Neck Pillow Standard"],
        // No Net Quantity, no Dimensions, no Packaged & Marketed By
        ["MRP", "₹1,199"],
      ])
    );
    const result = await extractStickerFromDocx(buffer, "FRD-SLP-NP-STD.docx");
    expect(result.extractionStatus).toBe("extracted");
    expect(result.missingFields).toContain("Net Quantity");
    expect(result.missingFields).toContain("Dimensions");
    expect(result.missingFields).toContain("Packaged & Marketed By");
    // But no critical missing fields
    expect(result.missingFields).not.toContain("MRP");
    expect(result.missingFields).not.toContain("Product Name");
    expect(result.missingFields).not.toContain("Sticker Identifier");
  });
});
