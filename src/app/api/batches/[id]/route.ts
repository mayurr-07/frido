import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { getBatchDetail, getBatchInvalidProducts } from "@/server/repository";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const start = performance.now();
  try {
    await requireUser();
    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format");

    if (format === "errors") {
      const { batch, invalidProducts } = await getBatchInvalidProducts(id);
      const header = ["Row Number", "Product Code", "Name", "Validation Issues", "Raw Row"];
      const lines = [header.join(",")];
      for (const product of invalidProducts) {
        lines.push(
          [
            product.rowNumber,
            product.productCode,
            product.name ?? "",
            product.issues.join(" | "),
            JSON.stringify(product.raw),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
      const totalDuration = (performance.now() - start).toFixed(1);
      console.log(
        `[timing] GET /api/batches/${id}?format=errors total=${totalDuration}ms invalidProducts=${invalidProducts.length}`
      );
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${batch.id}-import-errors.csv"`,
        },
      });
    }

    const detail = await getBatchDetail(id);

    if (format === "csv") {
      if (!detail.rawCsv) throw new ApiError(404, "Original CSV is not retained for this batch");
      const totalDuration = (performance.now() - start).toFixed(1);
      console.log(`[timing] GET /api/batches/${id}?format=csv total=${totalDuration}ms`);
      return new Response(detail.rawCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${detail.batch.id}-${detail.batch.csvFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        },
      });
    }

    const totalDuration = (performance.now() - start).toFixed(1);
    console.log(`[timing] GET /api/batches/${id} total=${totalDuration}ms matches=${detail.matches.length}`);
    return Response.json({ ok: true, ...detail });
  } catch (error) {
    const totalDuration = (performance.now() - start).toFixed(1);
    console.error(
      `[timing] GET /api/batches failed after ${totalDuration}ms:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return apiErrorResponse(error);
  }
}
