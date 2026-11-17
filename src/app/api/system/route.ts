import { apiErrorResponse, requireAdmin } from "@/server/auth";
import { getSystemHealth } from "@/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const health = await getSystemHealth();
    return Response.json({ ok: true, ...health, nodeEnv: process.env.NODE_ENV ?? "development" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
