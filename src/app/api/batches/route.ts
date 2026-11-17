import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { csvBatches, users } from "@/db/schema";
import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { createBatchFromCsv, batchColumns } from "@/server/repository";
import { CsvStructureError, parseItemMasterCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({ batch: batchColumns, uploaderName: users.displayName })
      .from(csvBatches)
      .leftJoin(users, eq(csvBatches.uploadedBy, users.id))
      .orderBy(desc(csvBatches.uploadedAt))
      .limit(200);
    return Response.json({
      ok: true,
      batches: rows.map((row) => ({
        id: row.batch.batchCode,
        uuid: row.batch.id,
        filename: row.batch.filename,
        uploadedAt: row.batch.uploadedAt,
        uploadedBy: row.uploaderName,
        processingStatus: row.batch.processingStatus,
        engineVersion: row.batch.engineVersion,
        totalRows: row.batch.totalRows,
        validRows: row.batch.validRows,
        invalidRows: row.batch.invalidRows,
        confirmed: row.batch.confirmedCount,
        needsReview: row.batch.needsReviewCount,
        conflicts: row.batch.conflictCount,
        unmatched: row.batch.unmatchedCount,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(422, "Attach a CSV file in the 'file' field");
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new ApiError(422, "Only .csv Item Master files are accepted");
    }
    if (file.size === 0) {
      throw new ApiError(422, "The uploaded file is empty");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, "File exceeds the 15 MB upload limit");
    }

    const rawCsv = await file.text();

    let parsed;
    try {
      parsed = parseItemMasterCsv(rawCsv, file.name);
    } catch (error) {
      if (error instanceof CsvStructureError) {
        throw new ApiError(422, error.message, {
          missingRequiredColumns: error.missingRequiredColumns,
        });
      }
      throw error;
    }

    if (parsed.validRows === 0) {
      throw new ApiError(422, "No valid product rows found. Every row failed validation.", {
        invalidRows: parsed.invalidRows,
        duplicates: parsed.duplicateProductCodes,
        sampleRows: parsed.rows.slice(0, 10).map((row) => ({ row: row.rowNumber, issues: row.issues })),
      });
    }

    const result = await createBatchFromCsv({
      parsed,
      rawCsv,
      fileSize: file.size,
      user,
      notes: parsed.invalidRows > 0 ? `${parsed.invalidRows} invalid row(s) excluded from matching.` : undefined,
    });

    return Response.json(
      {
        ok: true,
        batchCode: result.batchCode,
        matchCount: result.matchCount,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        duplicateProductCodes: parsed.duplicateProductCodes,
        unknownColumns: parsed.unknownColumns,
        invalidRowDetails: parsed.rows
          .filter((row) => !row.isValid)
          .slice(0, 25)
          .map((row) => ({ rowNumber: row.rowNumber, productCode: row.data.productCode, issues: row.issues })),
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
