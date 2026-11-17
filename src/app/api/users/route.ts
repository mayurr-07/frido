import { apiErrorResponse, requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ ok: true, users: await listUsers() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
