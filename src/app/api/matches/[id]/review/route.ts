import { z } from "zod";
import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { recordReviewDecision } from "@/server/repository";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "defer", "mark_unmatched"]),
  stickerId: z.string().trim().min(1).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "Invalid review decision payload", parsed.error.flatten());
    }

    const result = await recordReviewDecision({
      matchId: id,
      user,
      action: parsed.data.action,
      stickerId: parsed.data.stickerId ?? null,
      note: parsed.data.note,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
