import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */
export const userRoleEnum = pgEnum("user_role", ["super_admin", "employee"]);
export const matchStatusEnum = pgEnum("match_status", [
  "confirmed",
  "needs_review",
  "conflict",
  "unmatched",
]);
export const extractionStatusEnum = pgEnum("extraction_status", [
  "extracted",
  "needs_attention",
  "conflicted",
]);
export const batchStatusEnum = pgEnum("batch_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const reviewActionEnum = pgEnum("review_action", [
  "approve",
  "reject",
  "defer",
  "mark_unmatched",
  "reassign_candidate",
]);
export const reportTypeEnum = pgEnum("report_type", [
  "approved_only",
  "complete_report",
  "batch_summary",
  "conflict_report",
  "review_report",
]);

/* ------------------------------------------------------------------ users */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    jobTitle: text("job_title"),
    role: userRoleEnum("role").notNull().default("employee"),
    isActive: boolean("is_active").notNull().default(true),
    preferences: jsonb("preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ]
);

/* -------------------------------------------------------- sticker library */
export const stickerDocuments = pgTable(
  "sticker_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    source: text("source").notNull().default("uploaded"), // uploaded | seed_demo
    contentHash: text("content_hash"),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(1),
    extractionStatus: extractionStatusEnum("extraction_status")
      .notNull()
      .default("needs_attention"),
    extractionNote: text("extraction_note"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sticker_documents_filename_idx").on(t.filename)]
);

export const stickerReferences = pgTable(
  "sticker_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => stickerDocuments.id, { onDelete: "cascade" }),
    stickerIdentifier: text("sticker_identifier").notNull(),
    productName: text("product_name").notNull(),
    commonName: text("common_name"),
    netQuantity: text("net_quantity"),
    dimensions: text("dimensions"),
    manufacturingMonthYear: text("manufacturing_month_year"),
    batchNumber: text("batch_number"),
    packagedBy: text("packaged_by"),
    marketedBy: text("marketed_by"),
    countryOfOrigin: text("country_of_origin"),
    mrp: numeric("mrp", { precision: 12, scale: 2 }),
    customerCare: text("customer_care"),
    colorVariant: text("color_variant"),
    sizeVariant: text("size_variant"),
    category: text("category"),
    missingFields: jsonb("missing_fields").$type<string[]>().notNull().default([]),
    extractionStatus: extractionStatusEnum("extraction_status")
      .notNull()
      .default("needs_attention"),
    extractionNote: text("extraction_note"),
    familyKey: text("family_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sticker_refs_identifier_idx").on(t.stickerIdentifier),
    index("sticker_refs_document_idx").on(t.documentId),
  ]
);

/** Explicit, human-approved mapping layer. Never inferred automatically. */
export const productFamilyMappings = pgTable(
  "product_family_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyKey: text("family_key").notNull(),
    stickerIdentifier: text("sticker_identifier").notNull(),
    matchField: text("match_field").notNull().default("product_code"), // product_code | scan_identifier
    csvPattern: text("csv_pattern").notNull(),
    note: text("note"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("family_mappings_family_idx").on(t.familyKey)]
);

/* ------------------------------------------------------------- csv batches */
export const csvBatches = pgTable(
  "csv_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchCode: text("batch_code").notNull(),
    filename: text("filename").notNull(),
    fileSize: integer("file_size"),
    rawCsv: text("raw_csv"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    processingStatus: batchStatusEnum("processing_status").notNull().default("processing"),
    engineVersion: text("engine_version").notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    confirmedCount: integer("confirmed_count").notNull().default(0),
    needsReviewCount: integer("needs_review_count").notNull().default(0),
    conflictCount: integer("conflict_count").notNull().default(0),
    unmatchedCount: integer("unmatched_count").notNull().default(0),
    notes: text("notes"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("csv_batches_code_unique").on(t.batchCode),
    index("csv_batches_uploaded_at_idx").on(t.uploadedAt),
  ]
);

export const importedProducts = pgTable(
  "imported_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => csvBatches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    categoryCode: text("category_code"),
    productCode: text("product_code").notNull(),
    name: text("name"),
    description: text("description"),
    scanIdentifier: text("scan_identifier"),
    brand: text("brand"),
    color: text("color"),
    size: text("size"),
    lengthCm: text("length_cm"),
    widthCm: text("width_cm"),
    heightCm: text("height_cm"),
    weightG: text("weight_g"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    mrp: numeric("mrp", { precision: 12, scale: 2 }),
    enabled: boolean("enabled"),
    type: text("type"),
    componentProductCode: text("component_product_code"),
    catalogCategory: text("catalog_category"),
    rawData: jsonb("raw_data").$type<Record<string, string>>().notNull().default({}),
    isValid: boolean("is_valid").notNull().default(true),
    validationIssues: jsonb("validation_issues").$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("imported_products_batch_idx").on(t.batchId),
    index("imported_products_code_idx").on(t.productCode),
  ]
);

export const matchResults = pgTable(
  "match_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => csvBatches.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => importedProducts.id, { onDelete: "cascade" }),
    stickerId: uuid("sticker_id").references(() => stickerReferences.id, {
      onDelete: "set null",
    }),
    candidateStickerIds: jsonb("candidate_sticker_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    status: matchStatusEnum("status").notNull(),
    matchType: text("match_type").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleApplied: text("rule_applied").notNull(),
    engineVersion: text("engine_version").notNull(),
    reviewReason: text("review_reason"),
    conflictWarnings: jsonb("conflict_warnings").$type<string[]>().notNull().default([]),
    evidence: jsonb("evidence")
      .$type<Array<{ code: string; type: string; title: string; detail: string }>>()
      .notNull()
      .default([]),
    attributeComparisons: jsonb("attribute_comparisons")
      .$type<Array<{ attribute: string; csvValue: string | null; stickerValue: string | null; alignment: string }>>()
      .notNull()
      .default([]),
    reviewState: text("review_state").notNull().default("pending"), // pending | approved | rejected | deferred
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("match_results_batch_idx").on(t.batchId),
    index("match_results_status_idx").on(t.status),
  ]
);

export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchResults.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewerName: text("reviewer_name").notNull(),
    action: reviewActionEnum("action").notNull(),
    previousStatus: matchStatusEnum("previous_status").notNull(),
    newStatus: matchStatusEnum("new_status").notNull(),
    selectedStickerId: uuid("selected_sticker_id").references(() => stickerReferences.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_decisions_match_idx").on(t.matchId)]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    batchId: uuid("batch_id").references(() => csvBatches.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_created_idx").on(t.createdAt)]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportCode: text("report_code").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => csvBatches.id, { onDelete: "cascade" }),
    reportType: reportTypeEnum("report_type").notNull(),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    generatedByName: text("generated_by_name").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    productCount: integer("product_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("reports_code_unique").on(t.reportCode),
    index("reports_batch_idx").on(t.batchId),
  ]
);

export const processingRuns = pgTable(
  "processing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => csvBatches.id, { onDelete: "cascade" }),
    engineVersion: text("engine_version").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("completed"),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [index("processing_runs_batch_idx").on(t.batchId)]
);

/* --------------------------------------------------------------- relations */
export const stickerDocumentRelations = relations(stickerDocuments, ({ many }) => ({
  references: many(stickerReferences),
}));

export const stickerReferenceRelations = relations(stickerReferences, ({ one }) => ({
  document: one(stickerDocuments, {
    fields: [stickerReferences.documentId],
    references: [stickerDocuments.id],
  }),
}));

export const matchResultRelations = relations(matchResults, ({ one, many }) => ({
  batch: one(csvBatches, {
    fields: [matchResults.batchId],
    references: [csvBatches.id],
  }),
  product: one(importedProducts, {
    fields: [matchResults.productId],
    references: [importedProducts.id],
  }),
  sticker: one(stickerReferences, {
    fields: [matchResults.stickerId],
    references: [stickerReferences.id],
  }),
  decisions: many(reviewDecisions),
}));

export const csvBatchRelations = relations(csvBatches, ({ many }) => ({
  products: many(importedProducts),
  matches: many(matchResults),
  reports: many(reports),
}));

export type UserRow = typeof users.$inferSelect;
export type StickerDocumentRow = typeof stickerDocuments.$inferSelect;
export type StickerReferenceRow = typeof stickerReferences.$inferSelect;
export type CsvBatchRow = typeof csvBatches.$inferSelect;
export type ImportedProductRow = typeof importedProducts.$inferSelect;
export type MatchResultRow = typeof matchResults.$inferSelect;
export type ReviewDecisionRow = typeof reviewDecisions.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
