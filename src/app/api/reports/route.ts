import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { csvBatches, reports } from "@/db/schema";
import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { createReport } from "@/server/repository";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  batchId: z.string().trim().min(1),
  reportType: z.enum([
    "approved_only",
    "complete_report",
    "batch_summary",
    "conflict_report",
    "review_report",
  ]),
});

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({ report: reports, batch: csvBatches })
      .from(reports)
      .innerJoin(csvBatches, eq(reports.batchId, csvBatches.id))
      .orderBy(desc(reports.generatedAt))
      .limit(200);

    return Response.json({
      ok: true,
      reports: rows.map(({ report, batch }) => ({
        id: report.reportCode,
        uuid: report.id,
        batchId: batch.batchCode,
        csvFilename: batch.filename,
        reportType: report.reportType,
        generatedDate: report.generatedAt,
        generatedBy: report.generatedByName,
        productCount: report.productCount,
        confirmedCount: batch.confirmedCount,
        needsReviewCount: batch.needsReviewCount,
        conflictCount: batch.conflictCount,
        unmatchedCount: batch.unmatchedCount,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const start = performance.now();
  try {
    const user = await requireUser();
    const parsed = reportSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(422, "Invalid report request", parsed.error.flatten());
    }

    const report = await createReport({
      batchCodeOrId: parsed.data.batchId,
      reportType: parsed.data.reportType,
      user,
    });

    const totalDuration = (performance.now() - start).toFixed(1);
    console.log(
      `[timing] POST /api/reports batch=${parsed.data.batchId} type=${parsed.data.reportType} total=${totalDuration}ms products=${report.productCount}`
    );

    return Response.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    const totalDuration = (performance.now() - start).toFixed(1);
    console.error(
      `[timing] POST /api/reports failed after ${totalDuration}ms:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return apiErrorResponse(error);
  }
}
