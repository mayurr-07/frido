import { z } from "zod";
import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { bulkApproveMatches } from "@/server/repository";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  matchIds: z.array(z.string().trim().min(1)).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(422, "Provide between 1 and 100 match ids", parsed.error.flatten());
    }

    const results = await bulkApproveMatches(parsed.data.matchIds, user);
    return Response.json({
      ok: true,
      approved: results.approved,
      skipped: results.results.filter((r) => !r.approved).length,
      results: results.results,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
