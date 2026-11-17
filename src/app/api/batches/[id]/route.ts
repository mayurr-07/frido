import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { getBatchDetail } from "@/server/repository";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format");
    const detail = await getBatchDetail(id);

    if (format === "csv") {
      if (!detail.rawCsv) throw new ApiError(404, "Original CSV is not retained for this batch");
      return new Response(detail.rawCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${detail.batch.id}-${detail.batch.csvFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        },
      });
    }

    if (format === "errors") {
      const header = ["Row Number", "Product Code", "Name", "Validation Issues", "Raw Row"];
      const lines = [header.join(",")];
      for (const product of detail.products.filter((p) => !p.isValid)) {
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
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${detail.batch.id}-import-errors.csv"`,
        },
      });
    }

    return Response.json({ ok: true, ...detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
