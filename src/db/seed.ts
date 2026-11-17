import "dotenv/config";

import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  csvBatches,
  matchResults,
  productFamilyMappings,
  stickerDocuments,
  stickerReferences,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { parseItemMasterCsv } from "@/lib/csv";
import { DEMO_STICKERS } from "@/server/seed/demoStickers";
import { SEED_MAPPINGS, SEED_USERS, buildSeedBatches } from "@/server/seed/seedData";
import { createBatchFromCsv, createReport, recordReviewDecision } from "@/server/repository";
import { ENGINE_VERSION } from "@/server/matching/engine";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const existingUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const force = process.env.SEED_FORCE === "1";
  if ((existingUsers[0]?.count ?? 0) > 0 && !force) {
    console.log("[seed] workspace already contains users — nothing to do. Set SEED_FORCE=1 to reseed.");
    return;
  }

  console.log("[seed] clearing existing workspace data…");
  await db.execute(sql`
    TRUNCATE TABLE audit_events, review_decisions, match_results, imported_products,
      processing_runs, reports, csv_batches, product_family_mappings,
      sticker_references, sticker_documents, sessions, users
    RESTART IDENTITY CASCADE
  `);

  console.log("[seed] creating users…");
  const insertedUsers = await db
    .insert(users)
    .values(
      SEED_USERS.map((user) => ({
        email: user.email,
        passwordHash: hashPassword(user.password),
        displayName: user.displayName,
        jobTitle: user.jobTitle,
        role: user.role,
        preferences: {},
      }))
    )
    .returning();

  const admin = insertedUsers.find((user) => user.role === "super_admin");
  const ops = insertedUsers.find((user) => user.role === "employee");
  if (!admin || !ops) throw new Error("Seed users were not created correctly");

  console.log("[seed] importing demonstration sticker references…");
  for (const sticker of DEMO_STICKERS) {
    const missingFields: string[] = [];
    if (!sticker.netQuantity) missingFields.push("Net Quantity");
    if (!sticker.dimensions) missingFields.push("Dimensions");
    if (sticker.mrp === undefined) missingFields.push("MRP");

    const [document] = await db
      .insert(stickerDocuments)
      .values({
        filename: sticker.documentName,
        source: "seed_demo",
        uploadedBy: admin.id,
        extractionStatus: sticker.extractionStatus,
        extractionNote:
          sticker.extractionNote ??
          (missingFields.length > 0
            ? `Missing field(s): ${missingFields.join(", ")}.`
            : "Demonstration reference row — replace with the official DOCX upload."),
        extractedAt: new Date(sticker.lastUpdated),
        createdAt: new Date(sticker.lastUpdated),
      })
      .returning();

    await db.insert(stickerReferences).values({
      documentId: document.id,
      stickerIdentifier: sticker.stickerIdentifier,
      productName: sticker.productName,
      commonName: sticker.commonName ?? null,
      netQuantity: sticker.netQuantity ?? null,
      dimensions: sticker.dimensions ?? null,
      mrp: sticker.mrp !== undefined ? String(sticker.mrp) : null,
      customerCare: sticker.customerCareDetails ?? null,
      colorVariant: sticker.colorVariant ?? null,
      sizeVariant: sticker.sizeVariant ?? null,
      category: sticker.stickerIdentifier.split("-")[1] ?? null,
      missingFields,
      extractionStatus: sticker.extractionStatus,
      extractionNote: sticker.extractionNote ?? null,
      familyKey: sticker.stickerIdentifier.split("-").slice(0, 3).join("-"),
      updatedAt: new Date(sticker.lastUpdated),
      createdAt: new Date(sticker.lastUpdated),
    }).onConflictDoNothing();
  }

  console.log("[seed] approving explicit product-family mappings…");
  for (const mapping of SEED_MAPPINGS) {
    await db.insert(productFamilyMappings).values({
      familyKey: mapping.familyKey,
      stickerIdentifier: mapping.stickerIdentifier,
      csvPattern: mapping.csvPattern,
      matchField: mapping.matchField,
      note: mapping.note,
      approvedBy: admin.id,
    });
  }

  console.log("[seed] importing CSV batches through the production pipeline…");
  const userByEmail = new Map(insertedUsers.map((user) => [user.email, user]));
  for (const batch of buildSeedBatches()) {
    const user = userByEmail.get(batch.uploadedByEmail) ?? admin;
    const parsed = parseItemMasterCsv(batch.csv, batch.filename);
    const sessionUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      jobTitle: user.jobTitle,
      role: user.role,
      preferences: {},
    };
    const result = await createBatchFromCsv({
      parsed,
      rawCsv: batch.csv,
      fileSize: Buffer.byteLength(batch.csv, "utf8"),
      user: sessionUser,
      uploadedAt: batch.uploadedAt,
      notes: batch.notes,
      batchCode: batch.batchCode,
    });
    console.log(
      `[seed]   ${result.batchCode}: ${parsed.validRows} valid / ${parsed.invalidRows} invalid, ${result.matchCount} matches`
    );
  }

  console.log("[seed] recording demonstration review decisions…");
  const latestBatch = await db
    .select()
    .from(csvBatches)
    .where(eq(csvBatches.batchCode, "BATCH-2026-041"))
    .limit(1);

  if (latestBatch[0]) {
    const reviewable = await db
      .select({ id: matchResults.id, status: matchResults.status })
      .from(matchResults)
      .where(and(eq(matchResults.batchId, latestBatch[0].id), eq(matchResults.status, "needs_review")))
      .limit(3);

    const adminSession = {
      id: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      jobTitle: admin.jobTitle,
      role: admin.role,
      preferences: {},
    };

    if (reviewable[0]) {
      await recordReviewDecision({
        matchId: reviewable[0].id,
        user: adminSession,
        action: "approve",
        note: "Confirmed variant colour against approved sticker artwork.",
      });
    }
    if (reviewable[1]) {
      await recordReviewDecision({
        matchId: reviewable[1].id,
        user: adminSession,
        action: "defer",
        note: "Awaiting packaging team confirmation of the revised cover copy.",
      });
    }
  }

  console.log("[seed] generating demonstration reports…");
  const adminSession = {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
    jobTitle: admin.jobTitle,
    role: admin.role,
    preferences: {},
  };
  await createReport({ batchCodeOrId: "BATCH-2026-041", reportType: "complete_report", user: adminSession });
  await createReport({ batchCodeOrId: "BATCH-2026-038", reportType: "approved_only", user: adminSession });

  const summary = await db
    .select({
      batches: sql<number>`(select count(*) from ${csvBatches})::int`,
      matches: sql<number>`(select count(*) from ${matchResults})::int`,
      stickers: sql<number>`(select count(*) from ${stickerReferences})::int`,
    })
    .from(csvBatches)
    .limit(1);

  console.log(`[seed] complete with engine ${ENGINE_VERSION}.`, summary[0]);
  console.log("[seed] logins: admin@myfrido.com / Frido@2026 (SUPER_ADMIN), ops@myfrido.com / Frido@2026 (EMPLOYEE)");
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
