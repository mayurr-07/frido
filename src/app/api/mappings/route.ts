import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productFamilyMappings, users } from "@/db/schema";
import { apiErrorResponse, ApiError, requireAdmin, requireUser } from "@/server/auth";
import { addFamilyMapping } from "@/server/repository";

export const dynamic = "force-dynamic";

const mappingSchema = z.object({
  familyKey: z.string().trim().min(2).max(120),
  stickerIdentifier: z.string().trim().min(2).max(120),
  csvPattern: z.string().trim().min(2).max(120),
  matchField: z.enum(["product_code", "scan_identifier"]).default("product_code"),
  note: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({ mapping: productFamilyMappings, approver: users.displayName })
      .from(productFamilyMappings)
      .leftJoin(users, eq(productFamilyMappings.approvedBy, users.id))
      .orderBy(desc(productFamilyMappings.approvedAt))
      .limit(300);
    return Response.json({
      ok: true,
      mappings: rows.map(({ mapping, approver }) => ({
        ...mapping,
        approvedByName: approver,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const parsed = mappingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(422, "Invalid mapping payload", parsed.error.flatten());
    }
    const mapping = await addFamilyMapping({ ...parsed.data, user });
    return Response.json({ ok: true, mapping }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
