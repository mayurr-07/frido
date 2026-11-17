import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  csvBatches,
  importedProducts,
  matchResults,
  processingRuns,
  productFamilyMappings,
  reports,
  reviewDecisions,
  stickerDocuments,
  stickerReferences,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { ENGINE_VERSION, matchBatch, type EngineMapping, type EngineProduct, type EngineSticker } from "@/server/matching/engine";
import { extractStickerFromDocx } from "@/server/docx/extract";
import type { ParsedCsv } from "@/lib/csv";
import type {
  ActivityEvent,
  ItemMasterBatch,
  MatchResult,
  MatchType,
  Report,
  ReportType,
  ReviewAction,
  SessionProfile,
  StickerReference,
} from "@/types/frido";

/* ------------------------------------------------------------------ helpers */
const num = (value: string | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const iso = (date: Date | null | undefined): string => (date ? date.toISOString() : new Date().toISOString());

function batchStatus(row: {
  processingStatus: "queued" | "processing" | "completed" | "failed";
  needsReviewCount: number;
  conflictCount: number;
}): ItemMasterBatch["status"] {
  if (row.processingStatus === "failed") return "failed";
  if (row.processingStatus !== "completed") return "processing";
  return row.needsReviewCount + row.conflictCount > 0 ? "in_review" : "completed";
}

export const batchColumns = {
  id: csvBatches.id,
  batchCode: csvBatches.batchCode,
  filename: csvBatches.filename,
  fileSize: csvBatches.fileSize,
  uploadedBy: csvBatches.uploadedBy,
  uploadedAt: csvBatches.uploadedAt,
  processingStatus: csvBatches.processingStatus,
  engineVersion: csvBatches.engineVersion,
  totalRows: csvBatches.totalRows,
  validRows: csvBatches.validRows,
  invalidRows: csvBatches.invalidRows,
  confirmedCount: csvBatches.confirmedCount,
  needsReviewCount: csvBatches.needsReviewCount,
  conflictCount: csvBatches.conflictCount,
  unmatchedCount: csvBatches.unmatchedCount,
  notes: csvBatches.notes,
  errorMessage: csvBatches.errorMessage,
  createdAt: csvBatches.createdAt,
};

export type BatchRowSummary = {
  id: string;
  batchCode: string;
  filename: string;
  fileSize: number | null;
  uploadedBy: string | null;
  uploadedAt: Date;
  processingStatus: "queued" | "processing" | "completed" | "failed";
  engineVersion: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  confirmedCount: number;
  needsReviewCount: number;
  conflictCount: number;
  unmatchedCount: number;
  notes: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

function toBatch(row: BatchRowSummary, uploaderName: string): ItemMasterBatch {
  return {
    id: row.batchCode,
    uuid: row.id,
    csvFilename: row.filename,
    uploadDate: iso(row.uploadedAt),
    uploadedBy: uploaderName,
    totalProducts: row.totalRows,
    validRows: row.validRows,
    invalidRows: row.invalidRows,
    confirmedCount: row.confirmedCount,
    needsReviewCount: row.needsReviewCount,
    conflictCount: row.conflictCount,
    unmatchedCount: row.unmatchedCount,
    status: batchStatus(row),
    processingStatus: row.processingStatus,
    engineVersion: row.engineVersion,
    errorMessage: row.errorMessage ?? undefined,
    notes: row.notes ?? undefined,
    fileSize: row.fileSize ?? undefined,
  };
}

type StickerRow = typeof stickerReferences.$inferSelect & { documentName: string; documentSource: string };

function toSticker(row: StickerRow): StickerReference {
  return {
    id: row.id,
    documentId: row.documentId,
    documentName: row.documentName,
    documentSource: row.documentSource === "seed_demo" ? "seed_demo" : "uploaded",
    stickerIdentifier: row.stickerIdentifier,
    productName: row.productName,
    commonName: row.commonName ?? undefined,
    netQuantity: row.netQuantity ?? undefined,
    dimensions: row.dimensions ?? undefined,
    manufacturingMonthYear: row.manufacturingMonthYear ?? undefined,
    batchNumber: row.batchNumber ?? undefined,
    packagedBy: row.packagedBy ?? undefined,
    marketedBy: row.marketedBy ?? undefined,
    countryOfOrigin: row.countryOfOrigin ?? undefined,
    mrp: num(row.mrp),
    customerCareDetails: row.customerCare ?? undefined,
    colorVariant: row.colorVariant ?? undefined,
    sizeVariant: row.sizeVariant ?? undefined,
    category: row.category ?? undefined,
    familyKey: row.familyKey ?? undefined,
    missingFields: row.missingFields ?? [],
    extractionStatus: row.extractionStatus,
    extractionNote: row.extractionNote ?? undefined,
    lastUpdated: iso(row.updatedAt),
  };
}

const productSelect = {
  matchId: matchResults.id,
  status: matchResults.status,
  matchType: matchResults.matchType,
  ruleId: matchResults.ruleId,
  ruleApplied: matchResults.ruleApplied,
  engineVersion: matchResults.engineVersion,
  reviewReason: matchResults.reviewReason,
  conflictWarnings: matchResults.conflictWarnings,
  evidence: matchResults.evidence,
  attributeComparisons: matchResults.attributeComparisons,
  reviewState: matchResults.reviewState,
  reviewedAt: matchResults.reviewedAt,
  lastUpdated: matchResults.lastUpdated,
  batchCode: csvBatches.batchCode,
  stickerId: matchResults.stickerId,
  candidateStickerIds: matchResults.candidateStickerIds,
  product: importedProducts,
  reviewerName: users.displayName,
  sticker: stickerReferences,
  stickerDocumentName: stickerDocuments.filename,
  stickerDocumentSource: stickerDocuments.source,
};

async function fetchMatches(batchCodes?: string[], limit = 500): Promise<MatchResult[]> {
  const base = db
    .select(productSelect)
    .from(matchResults)
    .innerJoin(csvBatches, eq(matchResults.batchId, csvBatches.id))
    .innerJoin(importedProducts, eq(matchResults.productId, importedProducts.id))
    .leftJoin(stickerReferences, eq(matchResults.stickerId, stickerReferences.id))
    .leftJoin(stickerDocuments, eq(stickerReferences.documentId, stickerDocuments.id))
    .leftJoin(users, eq(matchResults.reviewedBy, users.id));

  const rows = batchCodes && batchCodes.length > 0
    ? await base.where(inArray(csvBatches.batchCode, batchCodes)).orderBy(asc(importedProducts.rowNumber)).limit(limit)
    : await base.orderBy(desc(csvBatches.uploadedAt), asc(importedProducts.rowNumber)).limit(limit);

  const matchIds = rows.map((r) => r.matchId);
  const decisions = matchIds.length
    ? await db
        .select({
          decision: reviewDecisions,
          stickerIdentifier: stickerReferences.stickerIdentifier,
        })
        .from(reviewDecisions)
        .leftJoin(stickerReferences, eq(reviewDecisions.selectedStickerId, stickerReferences.id))
        .where(inArray(reviewDecisions.matchId, matchIds))
        .orderBy(desc(reviewDecisions.createdAt))
    : [];

  const historyByMatch = new Map<string, ReviewAction[]>();
  for (const { decision, stickerIdentifier } of decisions) {
    const list = historyByMatch.get(decision.matchId) ?? [];
    list.push({
      id: decision.id,
      reviewer: decision.reviewerName,
      action:
        decision.action === "approve"
          ? "approved"
          : decision.action === "reject"
          ? "rejected"
          : decision.action === "defer"
          ? "kept_for_later"
          : decision.action === "mark_unmatched"
          ? "marked_unmatched"
          : "system_classified",
      previousStatus: decision.previousStatus,
      newStatus: decision.newStatus,
      timestamp: iso(decision.createdAt),
      note: decision.note ?? undefined,
      selectedStickerIdentifier: stickerIdentifier ?? undefined,
    });
    historyByMatch.set(decision.matchId, list);
  }

  return rows.map((row) => {
    const sticker = row.sticker
      ? toSticker({
          ...row.sticker,
          documentName: row.stickerDocumentName ?? "unknown.docx",
          documentSource: row.stickerDocumentSource ?? "uploaded",
        })
      : null;
    const p = row.product;
    return {
      id: row.matchId,
      batchId: row.batchCode,
      product: {
        id: p.id,
        productCode: p.productCode,
        name: p.name ?? "",
        description: p.description ?? undefined,
        categoryCode: p.categoryCode ?? undefined,
        scanIdentifier: p.scanIdentifier ?? undefined,
        brand: p.brand ?? "Frido",
        color: p.color ?? undefined,
        size: p.size ?? undefined,
        dimensions:
          [p.lengthCm, p.widthCm, p.heightCm].filter(Boolean).join(" × ") || undefined,
        lengthCm: p.lengthCm ?? undefined,
        widthCm: p.widthCm ?? undefined,
        heightCm: p.heightCm ?? undefined,
        weightG: p.weightG ?? undefined,
        basePrice: num(p.basePrice),
        costPrice: num(p.costPrice),
        mrp: num(p.mrp) ?? 0,
        enabled: p.enabled ?? undefined,
        type: p.type ?? undefined,
        componentProductCode: p.componentProductCode ?? undefined,
        catalogCategory: p.catalogCategory ?? undefined,
      },
      matchedSticker: sticker,
      candidateStickers: sticker ? [sticker] : [],
      matchType: (row.matchType as MatchType) ?? "no_reference",
      status: row.status,
      matchingRuleApplied: row.ruleApplied,
      ruleId: row.ruleId,
      engineVersion: row.engineVersion,
      reviewReason: row.reviewReason ?? undefined,
      conflictWarnings: row.conflictWarnings ?? [],
      evidence: (row.evidence ?? []).map((item, index) => ({
        id: `${row.matchId}-ev-${index}`,
        code: item.code,
        type: item.type as "positive" | "warning" | "conflict" | "neutral",
        title: item.title,
        detail: item.detail,
      })),
      attributeComparisons: (row.attributeComparisons ?? []) as MatchResult["attributeComparisons"],
      reviewHistory: historyByMatch.get(row.matchId) ?? [
        {
          id: `${row.matchId}-system`,
          reviewer: "Matching engine",
          action: "system_classified",
          previousStatus: "new",
          newStatus: row.status,
          timestamp: iso(row.lastUpdated),
          note: `Classified by engine ${row.engineVersion} using ${row.ruleId}.`,
        },
      ],
      reviewState: (row.reviewState as MatchResult["reviewState"]) ?? "pending",
      reviewedByName: row.reviewerName ?? undefined,
      reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : undefined,
      lastUpdated: iso(row.lastUpdated),
    } satisfies MatchResult;
  });
}

/* ---------------------------------------------------------------- bootstrap */
export async function getBootstrap(user: SessionUser) {
  const stickerRows = await db
    .select({
      reference: stickerReferences,
      documentName: stickerDocuments.filename,
      documentSource: stickerDocuments.source,
    })
    .from(stickerReferences)
    .innerJoin(stickerDocuments, eq(stickerReferences.documentId, stickerDocuments.id))
    .orderBy(asc(stickerReferences.stickerIdentifier));

  const batchRows = await db
    .select({ batch: batchColumns, uploaderName: users.displayName })
    .from(csvBatches)
    .leftJoin(users, eq(csvBatches.uploadedBy, users.id))
    .orderBy(desc(csvBatches.uploadedAt))
    .limit(200);

  const reportRows = await db
    .select({ report: reports, batchCode: csvBatches.batchCode, batch: batchColumns })
    .from(reports)
    .innerJoin(csvBatches, eq(reports.batchId, csvBatches.id))
    .orderBy(desc(reports.generatedAt))
    .limit(100);

  const activityRows = await db
    .select({ event: auditEvents, batchCode: csvBatches.batchCode })
    .from(auditEvents)
    .leftJoin(csvBatches, eq(auditEvents.batchId, csvBatches.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(40);

  const latestBatch = batchRows[0];
  const matches = await fetchMatches(latestBatch ? [latestBatch.batch.batchCode] : undefined, 300);

  return {
    user: toSessionProfile(user),
    stickers: stickerRows.map((row) =>
      toSticker({
        ...row.reference,
        documentName: row.documentName,
        documentSource: row.documentSource,
      })
    ),
    batches: batchRows.map((row) => toBatch(row.batch, row.uploaderName ?? "Unknown")),
    matches,
    reports: reportRows.map((row) => toReport(row.report, row.batchCode, row.batch)),
    activities: activityRows.map(
      (row): ActivityEvent => ({
        id: row.event.id,
        type: row.event.type,
        title: row.event.title,
        description: row.event.description ?? "",
        timestamp: iso(row.event.createdAt),
        actor: row.event.actorName,
        batchId: row.batchCode ?? undefined,
      })
    ),
    engineVersion: ENGINE_VERSION,
    fetchedAt: new Date().toISOString(),
  };
}

export function toSessionProfile(user: SessionUser): SessionProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    role: user.role,
  };
}

function toReport(
  row: typeof reports.$inferSelect,
  batchCode: string,
  batch: BatchRowSummary
): Report {
  return {
    id: row.reportCode,
    uuid: row.id,
    batchId: batchCode,
    csvFilename: batch.filename,
    generatedDate: iso(row.generatedAt),
    generatedBy: row.generatedByName,
    reportType: row.reportType,
    productCount: row.productCount,
    confirmedCount: batch.confirmedCount,
    needsReviewCount: batch.needsReviewCount,
    conflictCount: batch.conflictCount,
    unmatchedCount: batch.unmatchedCount,
  };
}

/* --------------------------------------------------------------- batch write */
export async function createBatchFromCsv(options: {
  parsed: ParsedCsv;
  rawCsv: string;
  fileSize: number;
  user: SessionUser;
  uploadedAt?: Date;
  notes?: string;
  batchCode?: string;
  skipAudit?: boolean;
}): Promise<{ batchCode: string; matchCount: number }> {
  const { parsed, rawCsv, fileSize, user, uploadedAt = new Date(), notes } = options;

  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(csvBatches);
  const sequence = (existing[0]?.count ?? 0) + 1;
  let batchCode = options.batchCode ?? `BATCH-${uploadedAt.getFullYear()}-${String(40 + sequence).padStart(3, "0")}`;
  const collision = await db.select({ id: csvBatches.id }).from(csvBatches).where(eq(csvBatches.batchCode, batchCode));
  if (collision.length > 0) {
    batchCode = `${batchCode}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const stickers = await fetchEngineStickers();
  const mappings = await fetchEngineMappings();

  const result = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(csvBatches)
      .values({
        batchCode,
        filename: parsed.filename,
        fileSize,
        rawCsv,
        uploadedBy: user.id,
        uploadedAt,
        processingStatus: "processing",
        engineVersion: ENGINE_VERSION,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        notes: notes ?? null,
        createdAt: uploadedAt,
      })
      .returning();

    const CHUNK_SIZE = 500;
    const insertedMap = new Map<number, string>();
    if (parsed.rows.length > 0) {
      for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
        const slice = parsed.rows.slice(i, i + CHUNK_SIZE);
        const insertedRows = await tx
          .insert(importedProducts)
          .values(
            slice.map((row) => ({
              batchId: batch.id,
              rowNumber: row.rowNumber,
              categoryCode: row.data.categoryCode,
              productCode: row.data.productCode || `UNKNOWN-ROW-${row.rowNumber}`,
              name: row.data.name,
              description: row.data.description,
              scanIdentifier: row.data.scanIdentifier,
              brand: row.data.brand,
              color: row.data.color,
              size: row.data.size,
              lengthCm: row.data.lengthCm,
              widthCm: row.data.widthCm,
              heightCm: row.data.heightCm,
              weightG: row.data.weightG,
              basePrice: row.data.basePrice !== null ? String(row.data.basePrice) : null,
              costPrice: row.data.costPrice !== null ? String(row.data.costPrice) : null,
              mrp: row.data.mrp !== null ? String(row.data.mrp) : null,
              enabled: row.data.enabled,
              type: row.data.type,
              componentProductCode: row.data.componentProductCode,
              catalogCategory: row.data.catalogCategory,
              rawData: row.raw,
              isValid: row.isValid,
              validationIssues: row.issues,
            }))
          )
          .returning({ id: importedProducts.id, rowNumber: importedProducts.rowNumber });

        for (const r of insertedRows) {
          insertedMap.set(r.rowNumber, r.id);
        }
      }
    }

    const validRows = parsed.rows.filter((row) => row.isValid);
    const engineProducts: EngineProduct[] = validRows.map((row) => ({
      id: insertedMap.get(row.rowNumber) ?? "",
      rowNumber: row.rowNumber,
      categoryCode: row.data.categoryCode,
      productCode: row.data.productCode,
      name: row.data.name,
      description: row.data.description,
      scanIdentifier: row.data.scanIdentifier,
      brand: row.data.brand,
      color: row.data.color,
      size: row.data.size,
      lengthCm: row.data.lengthCm,
      widthCm: row.data.widthCm,
      heightCm: row.data.heightCm,
      weightG: row.data.weightG,
      mrp: row.data.mrp,
      type: row.data.type,
      catalogCategory: row.data.catalogCategory,
    }));

    const results = matchBatch(engineProducts, stickers, mappings);

    if (results.length > 0) {
      for (let i = 0; i < results.length; i += CHUNK_SIZE) {
        const slice = results.slice(i, i + CHUNK_SIZE);
        await tx.insert(matchResults).values(
          slice.map((result) => ({
            batchId: batch.id,
            productId: result.productId,
            stickerId: result.stickerId,
            candidateStickerIds: result.candidateStickerIds,
            status: result.status,
            matchType: result.matchType,
            ruleId: result.ruleId,
            ruleApplied: result.ruleApplied,
            engineVersion: ENGINE_VERSION,
            reviewReason: result.reviewReason,
            conflictWarnings: result.conflictWarnings,
            evidence: result.evidence,
            attributeComparisons: result.attributeComparisons,
            reviewState: "pending",
            lastUpdated: uploadedAt,
          }))
        );
      }
    }

    const counts = {
      confirmedCount: results.filter((r) => r.status === "confirmed").length,
      needsReviewCount: results.filter((r) => r.status === "needs_review").length,
      conflictCount: results.filter((r) => r.status === "conflict").length,
      unmatchedCount: results.filter((r) => r.status === "unmatched").length,
    };

    await tx
      .update(csvBatches)
      .set({ ...counts, processingStatus: "completed" })
      .where(eq(csvBatches.id, batch.id));

    await tx.insert(processingRuns).values({
      batchId: batch.id,
      engineVersion: ENGINE_VERSION,
      startedAt: uploadedAt,
      finishedAt: new Date(),
      status: "completed",
      stats: { ...counts, invalidRows: parsed.invalidRows },
    });

    if (!options.skipAudit) {
      await tx.insert(auditEvents).values([
        {
          actorId: user.id,
          actorName: user.displayName,
          type: "csv_uploaded",
          title: "Item Master CSV uploaded",
          description: `${parsed.filename} imported as ${batchCode} (${parsed.totalRows} rows).`,
          batchId: batch.id,
          createdAt: uploadedAt,
        },
        {
          actorId: user.id,
          actorName: user.displayName,
          type: "matching_completed",
          title: `Matching completed for ${batchCode}`,
          description: `${results.length} valid rows classified with engine ${ENGINE_VERSION}; ${counts.confirmedCount} confirmed, ${counts.needsReviewCount} needs review, ${counts.conflictCount} conflicts, ${counts.unmatchedCount} unmatched.`,
          batchId: batch.id,
          createdAt: uploadedAt,
        },
      ]);
    }

    return { batchCode, matchCount: results.length };
  });

  return result;
}

async function fetchEngineStickers(): Promise<EngineSticker[]> {
  const rows = await db
    .select({ sticker: stickerReferences })
    .from(stickerReferences);
  return rows.map(({ sticker }) => ({
    id: sticker.id,
    stickerIdentifier: sticker.stickerIdentifier,
    productName: sticker.productName,
    commonName: sticker.commonName,
    colorVariant: sticker.colorVariant,
    sizeVariant: sticker.sizeVariant,
    mrp: num(sticker.mrp) ?? null,
    dimensions: sticker.dimensions,
    netQuantity: sticker.netQuantity,
    extractionStatus: sticker.extractionStatus,
    extractionNote: sticker.extractionNote,
    familyKey: sticker.familyKey,
  }));
}

async function fetchEngineMappings(): Promise<EngineMapping[]> {
  const rows = await db.select().from(productFamilyMappings);
  return rows.map((row) => ({
    id: row.id,
    familyKey: row.familyKey,
    stickerIdentifier: row.stickerIdentifier,
    csvPattern: row.csvPattern,
    matchField: row.matchField === "scan_identifier" ? "scan_identifier" : "product_code",
    isActive: row.isActive,
    note: row.note,
  }));
}

/* ------------------------------------------------------------- batch detail */
export async function resolveBatch(codeOrId: string) {
  const rows = await db
    .select({ batch: csvBatches, uploaderName: users.displayName })
    .from(csvBatches)
    .leftJoin(users, eq(csvBatches.uploadedBy, users.id))
    .where(
      or(
        eq(csvBatches.batchCode, codeOrId),
        sql`${csvBatches.id}::text = ${codeOrId}`
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getBatchDetail(codeOrId: string) {
  const resolved = await resolveBatch(codeOrId);
  if (!resolved) throw new ApiError(404, "Batch not found");
  const matches = await fetchMatches([resolved.batch.batchCode]);
  const products = await db
    .select()
    .from(importedProducts)
    .where(eq(importedProducts.batchId, resolved.batch.id))
    .orderBy(asc(importedProducts.rowNumber));
  return {
    batch: toBatch(resolved.batch, resolved.uploaderName ?? "Unknown"),
    rawCsv: resolved.batch.rawCsv ?? "",
    products: products.map((p) => ({
      id: p.id,
      rowNumber: p.rowNumber,
      productCode: p.productCode,
      name: p.name,
      mrp: num(p.mrp) ?? null,
      isValid: p.isValid,
      issues: p.validationIssues,
      raw: p.rawData,
    })),
    matches,
  };
}

/* ---------------------------------------------------------- review decisions */
export async function recordReviewDecision(options: {
  matchId: string;
  user: SessionUser;
  action: "approve" | "reject" | "defer" | "mark_unmatched";
  stickerId?: string | null;
  note?: string;
}) {
  const { matchId, user, action, note } = options;

  const rows = await db
    .select({ match: matchResults, batch: csvBatches, product: importedProducts })
    .from(matchResults)
    .innerJoin(csvBatches, eq(matchResults.batchId, csvBatches.id))
    .innerJoin(importedProducts, eq(matchResults.productId, importedProducts.id))
    .where(
      or(
        sql`${matchResults.id}::text = ${matchId}`,
        and(eq(csvBatches.batchCode, matchId), eq(importedProducts.productCode, importedProducts.productCode))
      )
    )
    .limit(1);

  const record = rows[0];
  if (!record) throw new ApiError(404, "Match result not found");

  const previousStatus = record.match.status;
  let newStatus: "confirmed" | "needs_review" | "conflict" | "unmatched" = previousStatus;
  let reviewState: "pending" | "approved" | "rejected" | "deferred" = "pending";
  let stickerId = record.match.stickerId;
  let selectedStickerId = record.match.stickerId;

  if (action === "approve") {
    const requestedStickerId = options.stickerId ?? record.match.stickerId;
    if (!requestedStickerId) {
      throw new ApiError(422, "Approval requires a selected sticker reference");
    }
    const stickerRows = await db
      .select({ id: stickerReferences.id })
      .from(stickerReferences)
      .where(or(eq(stickerReferences.id, requestedStickerId), eq(stickerReferences.stickerIdentifier, requestedStickerId)))
      .limit(1);
    if (stickerRows.length === 0) {
      throw new ApiError(422, "Selected sticker reference does not exist");
    }
    stickerId = stickerRows[0].id;
    selectedStickerId = stickerRows[0].id;
    newStatus = "confirmed";
    reviewState = "approved";
  } else if (action === "reject" || action === "mark_unmatched") {
    newStatus = "unmatched";
    reviewState = "rejected";
    stickerId = null;
  } else {
    reviewState = "deferred";
  }

  const updated = await db.transaction(async (tx) => {
    const [updatedMatch] = await tx
      .update(matchResults)
      .set({
        status: newStatus,
        stickerId,
        reviewState,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        lastUpdated: new Date(),
        reviewReason:
          action === "approve"
            ? note ?? "Manually approved after reviewer verification."
            : action === "reject" || action === "mark_unmatched"
            ? note ?? "Candidate reference rejected; product requires a new reference."
            : record.match.reviewReason,
      })
      .where(eq(matchResults.id, record.match.id))
      .returning();

    await tx.insert(reviewDecisions).values({
      matchId: record.match.id,
      reviewerId: user.id,
      reviewerName: user.displayName,
      action,
      previousStatus,
      newStatus,
      selectedStickerId,
      note: note ?? null,
    });

    const totals = await tx
      .select({
        confirmed: sql<number>`count(*) filter (where ${matchResults.status} = 'confirmed')::int`,
        needsReview: sql<number>`count(*) filter (where ${matchResults.status} = 'needs_review')::int`,
        conflicts: sql<number>`count(*) filter (where ${matchResults.status} = 'conflict')::int`,
        unmatched: sql<number>`count(*) filter (where ${matchResults.status} = 'unmatched')::int`,
      })
      .from(matchResults)
      .where(eq(matchResults.batchId, record.match.batchId));

    await tx
      .update(csvBatches)
      .set({
        confirmedCount: totals[0]?.confirmed ?? 0,
        needsReviewCount: totals[0]?.needsReview ?? 0,
        conflictCount: totals[0]?.conflicts ?? 0,
        unmatchedCount: totals[0]?.unmatched ?? 0,
      })
      .where(eq(csvBatches.id, record.match.batchId));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      actorName: user.displayName,
      type:
        action === "approve"
          ? "match_approved"
          : action === "defer"
          ? "match_deferred"
          : "match_rejected",
      title:
        action === "approve"
          ? `Match approved for ${record.product.productCode}`
          : action === "defer"
          ? `Match kept for later: ${record.product.productCode}`
          : `Match rejected for ${record.product.productCode}`,
      description: note ?? `Decision recorded in ${record.batch.batchCode}.`,
      batchId: record.match.batchId,
    });

    return updatedMatch;
  });

  return { matchId: updated.id, status: updated.status, reviewState: updated.reviewState, batchId: record.batch.batchCode };
}

export async function bulkApproveMatches(matchIds: string[], user: SessionUser) {
  const results: Array<{ matchId: string; approved: boolean; reason?: string }> = [];
  for (const matchId of matchIds) {
    try {
      const result = await recordReviewDecision({
        matchId,
        user,
        action: "approve",
        note: "Bulk approval from Matching Results (verified reference required).",
      });
      results.push({ matchId, approved: result.status === "confirmed" });
    } catch (error) {
      results.push({
        matchId,
        approved: false,
        reason: error instanceof ApiError ? error.message : "Approval failed",
      });
    }
  }
  return { approved: results.filter((r) => r.approved).length, results };
}

/* ----------------------------------------------------------------- stickers */
export async function addStickerDocx(options: {
  buffer: Buffer;
  filename: string;
  fileSize: number;
  user: SessionUser;
}) {
  const extracted = await extractStickerFromDocx(options.buffer, options.filename);
  if (!extracted.stickerIdentifier) {
    throw new ApiError(
      422,
      "No sticker identifier could be extracted from this document. Add an explicit identifier label and retry.",
      { missingFields: extracted.missingFields }
    );
  }

  const duplicates = await db
    .select({ id: stickerReferences.id })
    .from(stickerReferences)
    .where(eq(stickerReferences.stickerIdentifier, extracted.stickerIdentifier));

  const extractionStatus =
    extracted.extractionStatus === "extracted" && duplicates.length > 0
      ? ("conflicted" as const)
      : extracted.extractionStatus;
  const note =
    duplicates.length > 0
      ? `Identifier ${extracted.stickerIdentifier} already exists on ${duplicates.length} reference(s). Duplicate identifiers block automatic confirmation until resolved.`
      : extracted.extractionNote;

  const result = await db.transaction(async (tx) => {
    const [document] = await tx
      .insert(stickerDocuments)
      .values({
        filename: options.filename,
        source: "uploaded",
        fileSize: options.fileSize,
        uploadedBy: options.user.id,
        extractionStatus,
        extractionNote: note,
        extractedAt: new Date(),
      })
      .returning();

    const [reference] = await tx
      .insert(stickerReferences)
      .values({
        documentId: document.id,
        stickerIdentifier: extracted.stickerIdentifier!,
        productName: extracted.productName ?? "Unidentified product (verify DOCX)",
        commonName: extracted.commonName,
        netQuantity: extracted.netQuantity,
        dimensions: extracted.dimensions,
        manufacturingMonthYear: extracted.manufacturingMonthYear,
        batchNumber: extracted.batchNumber,
        packagedBy: extracted.packagedBy,
        marketedBy: extracted.marketedBy,
        countryOfOrigin: extracted.countryOfOrigin,
        mrp: extracted.mrp !== null ? String(extracted.mrp) : null,
        customerCare: extracted.customerCare,
        colorVariant: extracted.colorVariant,
        sizeVariant: extracted.sizeVariant,
        category: extracted.familyKey,
        missingFields: extracted.missingFields,
        extractionStatus,
        extractionNote: note,
        familyKey: extracted.familyKey,
      })
      .returning();

    await tx.insert(auditEvents).values({
      actorId: options.user.id,
      actorName: options.user.displayName,
      type: "sticker_document_imported",
      title: `Sticker reference imported: ${extracted.stickerIdentifier}`,
      description: `${options.filename} extracted with mammoth (${extracted.missingFields.length} missing field(s)).`,
    });

    return { document, reference };
  });

  return {
    documentId: result.document.id,
    stickerId: result.reference.id,
    stickerIdentifier: extracted.stickerIdentifier,
    extractionStatus,
    missingFields: extracted.missingFields,
  };
}

export async function addFamilyMapping(options: {
  user: SessionUser;
  familyKey: string;
  stickerIdentifier: string;
  csvPattern: string;
  matchField: "product_code" | "scan_identifier";
  note?: string;
}) {
  const sticker = await db
    .select({ id: stickerReferences.id })
    .from(stickerReferences)
    .where(eq(stickerReferences.stickerIdentifier, options.stickerIdentifier))
    .limit(1);
  if (sticker.length === 0) throw new ApiError(422, "Sticker identifier not found in the library");

  const [mapping] = await db
    .insert(productFamilyMappings)
    .values({
      familyKey: options.familyKey,
      stickerIdentifier: options.stickerIdentifier,
      csvPattern: options.csvPattern,
      matchField: options.matchField,
      note: options.note ?? null,
      approvedBy: options.user.id,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: options.user.id,
    actorName: options.user.displayName,
    type: "mapping_approved",
    title: `Mapping approved: ${options.csvPattern} → ${options.stickerIdentifier}`,
    description: options.note ?? "Explicit family mapping added by administrator.",
  });

  return mapping;
}

/* ------------------------------------------------------------------ reports */
export async function createReport(options: {
  batchCodeOrId: string;
  reportType: ReportType;
  user: SessionUser;
}) {
  const resolved = await resolveBatch(options.batchCodeOrId);
  if (!resolved) throw new ApiError(404, "Batch not found");

  const matches = await fetchMatches([resolved.batch.batchCode]);
  const scoped = scopeMatches(reportTypeScope(options.reportType), matches);
  const sequence = await db.select({ count: sql<number>`count(*)::int` }).from(reports);
  const reportCode = `RPT-${new Date().getFullYear()}-${String(110 + (sequence[0]?.count ?? 0)).padStart(3, "0")}`;

  const [inserted] = await db
    .insert(reports)
    .values({
      reportCode,
      batchId: resolved.batch.id,
      reportType: options.reportType,
      generatedBy: options.user.id,
      generatedByName: options.user.displayName,
      productCount: scoped.length,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: options.user.id,
    actorName: options.user.displayName,
    type: "report_generated",
    title: `PDF report generated: ${reportCode}`,
    description: `${options.reportType} report for ${resolved.batch.batchCode} (${scoped.length} products).`,
    batchId: resolved.batch.id,
  });

  return toReport(inserted, resolved.batch.batchCode, resolved.batch);
}

function reportTypeScope(type: ReportType): string {
  switch (type) {
    case "approved_only":
      return "confirmed";
    case "conflict_report":
      return "conflict";
    case "review_report":
      return "reviewed";
    case "batch_summary":
      return "all";
    default:
      return "all";
  }
}

export async function getReportPdfData(codeOrId: string) {
  const rows = await db
    .select({ report: reports, batch: csvBatches, uploaderName: users.displayName })
    .from(reports)
    .innerJoin(csvBatches, eq(reports.batchId, csvBatches.id))
    .leftJoin(users, eq(csvBatches.uploadedBy, users.id))
    .where(or(eq(reports.reportCode, codeOrId), sql`${reports.id}::text = ${codeOrId}`))
    .limit(1);

  const record = rows[0];
  if (!record) throw new ApiError(404, "Report not found");

  const matches = await fetchMatches([record.batch.batchCode]);
  const scoped = scopeMatches(reportTypeScope(record.report.reportType), matches);

  return {
    report: record.report,
    batch: record.batch,
    uploaderName: record.uploaderName ?? "Unknown",
    matches: scoped,
  };
}

function scopeMatches(scope: string, matches: MatchResult[]): MatchResult[] {
  if (scope === "confirmed") return matches.filter((m) => m.status === "confirmed");
  if (scope === "conflict") return matches.filter((m) => m.status === "conflict");
  if (scope === "reviewed") {
    return matches.filter((m) => m.reviewState !== "pending" || m.status === "needs_review" || m.status === "conflict");
  }
  return matches;
}

/* -------------------------------------------------------------- preferences */
export async function updateUserPreferences(user: SessionUser, preferences: Record<string, unknown>) {
  const merged = { ...user.preferences, ...preferences };
  await db.update(users).set({ preferences: merged }).where(eq(users.id, user.id));
  return merged;
}

export async function listUsers() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.displayName));
  return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
}

export async function getSystemHealth() {
  const [counts] = await db
    .select({
      batches: sql<number>`(select count(*) from ${csvBatches})::int`,
      products: sql<number>`(select count(*) from ${importedProducts})::int`,
      matches: sql<number>`(select count(*) from ${matchResults})::int`,
      stickers: sql<number>`(select count(*) from ${stickerReferences})::int`,
      documents: sql<number>`(select count(*) from ${stickerDocuments})::int`,
      conflicts: sql<number>`(select count(*) from ${matchResults} where status = 'conflict')::int`,
      decisions: sql<number>`(select count(*) from ${reviewDecisions})::int`,
      reports: sql<number>`(select count(*) from ${reports})::int`,
    })
    .from(csvBatches)
    .limit(1);

  const lastSync = await db.select({ uploadedAt: csvBatches.uploadedAt }).from(csvBatches).orderBy(desc(csvBatches.uploadedAt)).limit(1);

  return {
    database: "connected",
    engineVersion: ENGINE_VERSION,
    counts: counts ?? {
      batches: 0,
      products: 0,
      matches: 0,
      stickers: 0,
      documents: 0,
      conflicts: 0,
      decisions: 0,
      reports: 0,
    },
    lastBatchAt: lastSync[0] ? iso(lastSync[0].uploadedAt) : null,
  };
}
