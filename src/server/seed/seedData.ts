import Papa from "papaparse";
import { DEMO_STICKERS, type DemoSticker } from "./demoStickers";

/**
 * Demonstration dataset for the Frido workspace.
 *
 * IMPORTANT: the sticker references below are clearly-labelled demonstration rows
 * (source = seed_demo). They are not official Frido artwork. Real references must be
 * uploaded as DOCX through the Sticker Library so the mammoth extractor produces the
 * fields. CSV batches are produced through the same production ingestion path as a
 * real upload (parse -> deterministic engine -> persistence).
 */

export const SEED_USERS = [
  {
    email: "admin@myfrido.com",
    password: "Frido@2026",
    displayName: "Aarav Mehta",
    jobTitle: "Product Operations Lead",
    role: "super_admin" as const,
  },
  {
    email: "ops@myfrido.com",
    password: "Frido@2026",
    displayName: "Priya Nair",
    jobTitle: "Packaging & Compliance Executive",
    role: "employee" as const,
  },
];

export const SEED_MAPPINGS = [
  {
    familyKey: "frido-coccyx-xl-seasonal",
    stickerIdentifier: "FRD-SIT-CX-XL",
    csvPattern: "FRD-SIT-CX-XL-*",
    matchField: "product_code" as const,
    note: "Seasonal suffix retained on XL coccyx cushion SKUs; packaging artwork unchanged.",
  },
  {
    familyKey: "frido-travel-pillow-colours",
    stickerIdentifier: "FRD-SLP-TRVL-BLK",
    csvPattern: "FRD-SLP-TRVL-*",
    matchField: "product_code" as const,
    note: "Colour variants share one prize sticker; variant colour differences require review.",
  },
  {
    familyKey: "frido-gel-seat-revisions",
    stickerIdentifier: "FRD-SIT-GELSIT",
    csvPattern: "FRD-SIT-GELSIT-*",
    matchField: "product_code" as const,
    note: "Revision suffix (-V2) approved against the Rev B sticker document.",
  },
];

const HEADER = [
  "Category Code",
  "Product Code",
  "Name",
  "Description",
  "Scan Identifier",
  "Brand",
  "Color",
  "Size",
  "Length",
  "Width",
  "Height",
  "Weight",
  "Base Price",
  "Cost Price",
  "MRP",
  "Enabled",
  "Type",
  "Component Product Code",
  "Catalog Category Full Name",
];

function stickerByCode(code: string): DemoSticker {
  const found = DEMO_STICKERS.find((sticker) => sticker.stickerIdentifier === code);
  if (!found) throw new Error(`Seed sticker not found: ${code}`);
  return found;
}

function dimensions(sticker: DemoSticker): [string, string, string] {
  const match = (sticker.dimensions ?? "").match(/(\d+(?:\.\d+)?)\s*cm\s*×\s*(\d+(?:\.\d+)?)\s*cm\s*×\s*(\d+(?:\.\d+)?)/);
  if (!match) return ["", "", ""];
  return [match[1], match[2], match[3]];
}

type SeedRow = Record<string, string>;
let scanSequence = 100;

function rowFromSticker(
  code: string,
  overrides: Partial<{
    code: string;
    name: string;
    color: string;
    size: string;
    mrp: number;
    scan: string;
    description: string;
    type: string;
  }> = {}
): SeedRow {
  const sticker = stickerByCode(code);
  const [length, width, height] = dimensions(sticker);
  const mrp = overrides.mrp ?? sticker.mrp ?? 999;
  const category = sticker.stickerIdentifier.split("-")[1] ?? "GEN";
  scanSequence += 1;
  return {
    "Category Code": category,
    "Product Code": overrides.code ?? sticker.stickerIdentifier,
    Name: overrides.name ?? sticker.productName,
    Description: overrides.description ?? `${sticker.commonName ?? sticker.productName} — import row from Item Master CSV.`,
    "Scan Identifier": overrides.scan ?? `8906${String(scanSequence).padStart(9, "0")}`,
    Brand: "Frido",
    Color: overrides.color ?? sticker.colorVariant ?? "Standard",
    Size: overrides.size ?? sticker.sizeVariant ?? "Standard",
    Length: length,
    Width: width,
    Height: height,
    Weight: "850",
    "Base Price": String(Math.round(mrp * 0.55)),
    "Cost Price": String(Math.round(mrp * 0.7)),
    MRP: String(mrp),
    Enabled: "TRUE",
    Type: overrides.type ?? category,
    "Component Product Code": "",
    "Catalog Category Full Name": `Frido > ${category} > ${sticker.commonName ?? "Products"}`,
  };
}

function customRow(overrides: {
  category: string;
  code: string;
  name: string;
  description: string;
  scan: string;
  mrp: number;
  color: string;
  size: string;
  type: string;
}): SeedRow {
  scanSequence += 1;
  return {
    "Category Code": overrides.category,
    "Product Code": overrides.code,
    Name: overrides.name,
    Description: overrides.description,
    "Scan Identifier": overrides.scan,
    Brand: "Frido",
    Color: overrides.color,
    Size: overrides.size,
    Length: "42",
    Width: "36",
    Height: "10",
    Weight: "900",
    "Base Price": String(Math.round(overrides.mrp * 0.55)),
    "Cost Price": String(Math.round(overrides.mrp * 0.7)),
    MRP: String(overrides.mrp),
    Enabled: "TRUE",
    Type: overrides.type,
    "Component Product Code": "",
    "Catalog Category Full Name": `Frido > ${overrides.category} > ${overrides.type}`,
  };
}

function csv(rows: SeedRow[]): string {
  return Papa.unparse(rows, { columns: HEADER, newline: "\n" });
}

export type SeedBatch = {
  batchCode: string;
  filename: string;
  uploadedAt: Date;
  uploadedByEmail: string;
  notes: string;
  csv: string;
};

export function buildSeedBatches(): SeedBatch[] {
  const january = csv([
    rowFromSticker("FRD-INS-DG-M"),
    rowFromSticker("FRD-INS-DG-L"),
    rowFromSticker("FRD-INS-AS-M"),
    rowFromSticker("FRD-INS-SP-M"),
  ]);

  const february = csv([
    rowFromSticker("FRD-INS-HC-U"),
    rowFromSticker("FRD-SIT-CX-BLK"),
    rowFromSticker("FRD-SIT-CX-GRY"),
    rowFromSticker("FRD-SLP-CRV-STD"),
    rowFromSticker("FRD-SIT-LMB-BLK", {
      code: "FRD-RETAIL-LMB-001",
      scan: "FRD-SIT-LMB-BLK",
      name: "Frido Ergonomic Lumbar Back Support Pillow — Retail Carton",
      description: "Retail carton SKU identified by scan identifier FRD-SIT-LMB-BLK.",
    }),
  ]);

  const march = csv([
    rowFromSticker("FRD-SIT-CAR-BLK"),
    rowFromSticker("FRD-SIT-LMB-PRO"),
    rowFromSticker("FRD-SIT-FR-STD"),
    rowFromSticker("FRD-SIT-WDG-8"),
    rowFromSticker("FRD-SLP-CRV-KNG"),
    rowFromSticker("FRD-SLP-KNEE"),
    rowFromSticker("FRD-SIT-CX-XL", { code: "FRD-SIT-CX-XL-26" }),
    rowFromSticker("FRD-SLP-TRVL-BLK", {
      code: "FRD-SLP-TRVL-YEL-V2",
      color: "Frido Yellow",
      name: "Frido Ultimate Travel Neck Pillow - Frido Yellow (V2)",
    }),
  ]);

  const aprilRows: SeedRow[] = [
    rowFromSticker("FRD-INS-DG-S"),
    rowFromSticker("FRD-INS-PF-S"),
    rowFromSticker("FRD-INS-SP-L"),
    rowFromSticker("FRD-SLP-DEEP"),
    rowFromSticker("FRD-SLP-WDG-10"),
    rowFromSticker("FRD-SLP-WDG-12"),
    rowFromSticker("FRD-INS-HI-M"),
    rowFromSticker("FRD-SIT-GELSIT", { code: "FRD-SIT-GELSIT-V2" }),
    rowFromSticker("FRD-SLP-LEG", { code: "FRD-SLP-LEG-REV" }),
    rowFromSticker("FRD-INS-AS-L", {
      code: "FRD-INS-AS-L-NEW",
      name: "Frido Everyday Arch Support Insole — Large (Updated Foam)",
      description: "Updated EVA base layer; confirm packaging copy matches approved sticker.",
    }),
    rowFromSticker("FRD-SLP-CRV-STD", { code: "FRD-SLP-CRV-STD-26" }),
    rowFromSticker("FRD-SIT-CX-BLK", {
      code: "FRD-SIT-CX-BLK-26",
      name: "Frido Ultimate Coccyx Cushion - Obsidian Edition",
      description: "Seasonal colour variant of the coccyx cushion.",
      color: "Obsidian Black",
      mrp: 2099,
    }),
    rowFromSticker("FRD-SLP-WDG-10", {
      code: "FRD-SLP-WDG-10-PRO",
      name: "Frido Ultimate Bed Wedge Pillow 10 Inch (Washable Cover)",
      description: "Washable bamboo-blend cover bundle.",
      mrp: 3599,
    }),
    rowFromSticker("FRD-SLP-KNEE", { mrp: 1499 }),
    customRow({
      category: "WALK",
      code: "FRD-WALK-RECOVERY-SLIDE-M",
      name: "Frido CloudWalk Recovery Slides - Medium",
      description: "New EVA recovery footwear line.",
      scan: "8906000099901",
      mrp: 1499,
      color: "Mustard Yellow",
      size: "Medium (UK 7–8)",
      type: "Footwear",
    }),
    customRow({
      category: "SLP",
      code: "FRD-ACC-PILLOW-COVER-CRV",
      name: "Frido Spare Bamboo Cover for Cervical Pillow",
      description: "Replacement zippered pillowcase accessory.",
      scan: "8906000099902",
      mrp: 549,
      color: "Cloud White",
      size: "Standard",
      type: "Accessory",
    }),
    // Deliberate duplicate Product Code to demonstrate import-level rejection.
    rowFromSticker("FRD-INS-DG-S", {
      name: "Duplicate row — Frido Dual Gel Insoles Small",
    }),
  ];

  return [
    {
      batchCode: "BATCH-2026-024",
      filename: "Frido_ItemMaster_Jan2026_Launch.csv",
      uploadedAt: new Date("2026-01-29T16:40:00Z"),
      uploadedByEmail: "admin@myfrido.com",
      notes: "January baseline catalogue verification.",
      csv: january,
    },
    {
      batchCode: "BATCH-2026-031",
      filename: "Frido_ItemMaster_Feb2026_Retail.csv",
      uploadedAt: new Date("2026-02-19T10:55:00Z"),
      uploadedByEmail: "ops@myfrido.com",
      notes: "Offline retail partner distributor catalogue.",
      csv: february,
    },
    {
      batchCode: "BATCH-2026-038",
      filename: "Frido_ItemMaster_Mar2026_Marketplace.csv",
      uploadedAt: new Date("2026-03-22T14:08:00Z"),
      uploadedByEmail: "ops@myfrido.com",
      notes: "Amazon & Flipkart replenishment feed.",
      csv: march,
    },
    {
      batchCode: "BATCH-2026-041",
      filename: "Frido_ItemMaster_Q2_Apr2026_v3.csv",
      uploadedAt: new Date("2026-04-08T09:12:00Z"),
      uploadedByEmail: "admin@myfrido.com",
      notes: "Q2 marketplace & D2C catalogue import, including seasonal variants.",
      csv: csv(aprilRows),
    },
  ];
}
