import { apiErrorResponse, requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  try {
    const tAuthStart = performance.now();
    await requireAdmin();
    const tAuth = (performance.now() - tAuthStart).toFixed(1);

    const tDbStart = performance.now();
    const userList = await listUsers();
    const tDb = (performance.now() - tDbStart).toFixed(1);

    const totalDuration = (performance.now() - start).toFixed(1);
    console.log(
      `[timing] GET /api/users total=${totalDuration}ms (auth=${tAuth}ms, db=${tDb}ms, count=${userList.length})`
    );

    return Response.json({ ok: true, users: userList });
  } catch (error) {
    const totalDuration = (performance.now() - start).toFixed(1);
    console.error(
      `[timing] GET /api/users failed after ${totalDuration}ms:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return apiErrorResponse(error);
  }
}
