import { apiErrorResponse, requireUser } from "@/server/auth";
import { getReportPdfData } from "@/server/repository";
import { generateReportPdf, type PdfMatchRow } from "@/server/reports/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await context.params;
    const data = await getReportPdfData(id);

    const rows: PdfMatchRow[] = data.matches.map((match) => {
      const latestDecision = match.reviewHistory[0];
      return {
        productCode: match.product.productCode,
        productName: match.product.name,
        mrp: match.product.mrp > 0 ? match.product.mrp : null,
        stickerIdentifier: match.matchedSticker?.stickerIdentifier ?? null,
        status: match.status,
        ruleId: match.ruleId,
        evidence: match.evidence[0]?.title ?? match.matchingRuleApplied,
        reviewerNote:
          match.reviewState !== "pending" && latestDecision?.note
            ? `${latestDecision.reviewer}: ${latestDecision.note}`
            : null,
        reviewedBy: match.reviewedByName ?? null,
      };
    });

    const pdf = await generateReportPdf({
      reportCode: data.report.reportCode,
      reportType: data.report.reportType,
      generatedAt: data.report.generatedAt,
      generatedByName: data.report.generatedByName,
      batch: {
        batchCode: data.batch.batchCode,
        filename: data.batch.filename,
        uploadedAt: data.batch.uploadedAt,
        processedAt: data.batch.createdAt,
        uploadedBy: data.uploaderName,
        engineVersion: data.batch.engineVersion,
        totalRows: data.batch.totalRows,
        validRows: data.batch.validRows,
        invalidRows: data.batch.invalidRows,
        confirmed: data.batch.confirmedCount,
        needsReview: data.batch.needsReviewCount,
        conflicts: data.batch.conflictCount,
        unmatched: data.batch.unmatchedCount,
      },
      rows,
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.report.reportCode}-${data.batch.batchCode}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
