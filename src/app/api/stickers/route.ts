import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stickerDocuments, stickerReferences } from "@/db/schema";
import { apiErrorResponse, ApiError, requireAdmin, requireUser } from "@/server/auth";
import { addStickerDocx } from "@/server/repository";

export const dynamic = "force-dynamic";

const MAX_DOCX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({
        reference: stickerReferences,
        documentName: stickerDocuments.filename,
        documentSource: stickerDocuments.source,
      })
      .from(stickerReferences)
      .innerJoin(stickerDocuments, eq(stickerReferences.documentId, stickerDocuments.id))
      .orderBy(desc(stickerReferences.updatedAt))
      .limit(500);

    return Response.json({
      ok: true,
      stickers: rows.map((row) => ({
        ...row.reference,
        documentName: row.documentName,
        documentSource: row.documentSource,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(422, "Attach a Word document in the 'file' field");
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      throw new ApiError(422, "Only .docx prize sticker documents are accepted");
    }
    if (file.size === 0) throw new ApiError(422, "The uploaded document is empty");
    if (file.size > MAX_DOCX_BYTES) throw new ApiError(413, "Document exceeds the 20 MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await addStickerDocx({
      buffer,
      filename: file.name,
      fileSize: file.size,
      user,
    });

    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
