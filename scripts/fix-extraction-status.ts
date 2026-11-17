/**
 * fix-extraction-status.ts
 *
 * One-time migration: re-evaluate extractionStatus for all existing sticker references
 * using the new critical/informational field separation logic.
 *
 * Rules applied:
 *   Critical (block → needs_attention): missing Sticker Identifier, Product Name, or MRP.
 *   Informational (warn only):          missing Net Quantity, Dimensions, Packaged & Marketed By.
 *   Conflicts (block → needs_attention): multiple MRP values, no product name at all.
 *
 * Records where the ONLY reason for needs_attention was an informational field (e.g.
 * "Packaged & Marketed By") are upgraded to "extracted".
 * Truly blocking cases (conflicted MRP, missing identifier/name/MRP) are left as-is.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/fix-extraction-status.ts
 */

import { db } from "@/db";
import { stickerReferences } from "@/db/schema";

const CRITICAL_FIELD_NAMES = new Set(["Sticker Identifier", "Product Name", "MRP"]);
const INFORMATIONAL_FIELD_NAMES = new Set(["Net Quantity", "Dimensions", "Packaged & Marketed By"]);

function isOnlyInformational(missingFields: string[]): boolean {
  if (missingFields.length === 0) return false;
  return missingFields.every((f) => INFORMATIONAL_FIELD_NAMES.has(f));
}

async function main() {
  console.log("Fetching sticker references...");
  const all = await db
    .select({
      id: stickerReferences.id,
      stickerIdentifier: stickerReferences.stickerIdentifier,
      extractionStatus: stickerReferences.extractionStatus,
      missingFields: stickerReferences.missingFields,
      extractionNote: stickerReferences.extractionNote,
    })
    .from(stickerReferences);

  console.log(`Found ${all.length} sticker reference(s).`);

  const toUpgrade: typeof all = [];
  const unchanged: typeof all = [];

  for (const row of all) {
    if (row.extractionStatus !== "needs_attention") {
      unchanged.push(row);
      continue;
    }

    const missing: string[] = Array.isArray(row.missingFields) ? row.missingFields : [];
    const hasCritical = missing.some((f) => CRITICAL_FIELD_NAMES.has(f));

    // If the only reason it was needs_attention is informational fields, upgrade it.
    // Note: We can't detect conflict notes from the DB directly, but we check: if the
    // existing extractionNote mentions "Multiple different MRP" that is a conflict and
    // must stay as needs_attention.
    const hasConflictNote =
      typeof row.extractionNote === "string" &&
      row.extractionNote.includes("Multiple different MRP");

    if (!hasCritical && !hasConflictNote) {
      toUpgrade.push(row);
    } else {
      unchanged.push(row);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  To upgrade → "extracted": ${toUpgrade.length}`);
  console.log(`  Unchanged (critical/conflict): ${unchanged.filter((r) => r.extractionStatus === "needs_attention").length}`);
  console.log(`  Already extracted/conflicted: ${unchanged.filter((r) => r.extractionStatus !== "needs_attention").length}`);

  if (toUpgrade.length === 0) {
    console.log("\nNo records need upgrading. Done.");
    process.exit(0);
  }

  console.log("\nUpgrading records...");
  let updated = 0;

  for (const row of toUpgrade) {
    const missing: string[] = Array.isArray(row.missingFields) ? row.missingFields : [];
    const informationalOnly = missing.filter((f) => INFORMATIONAL_FIELD_NAMES.has(f));

    // Rebuild the extraction note to reflect the new logic.
    const newNote =
      informationalOnly.length > 0
        ? `Informational warning — missing field(s): ${informationalOnly.join(", ")}.`
        : null;

    await db
      .update(stickerReferences)
      .set({
        extractionStatus: "extracted",
        extractionNote: newNote,
      })
      .where(
        // Use drizzle's eq helper
        (await import("drizzle-orm")).eq(stickerReferences.id, row.id)
      );

    console.log(`  ✓ ${row.stickerIdentifier ?? row.id} → extracted (was: needs_attention, missing: ${missing.join(", ")})`);
    updated++;
  }

  console.log(`\nDone. ${updated} record(s) upgraded to "extracted".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
