import { apiErrorResponse, getWorkspaceIdentity } from "@/server/auth";
import { getBootstrap } from "@/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, authMode } = await getWorkspaceIdentity();
    const payload = await getBootstrap(user);
    return Response.json({ ...payload, authMode });
  } catch (initialError) {
    console.error("[bootstrap] initial error caught:", initialError instanceof Error ? (initialError.stack || initialError.message) : initialError);
    // Neon serverless databases auto-suspend when idle; if waking up, retry once after a short delay
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const { user, authMode } = await getWorkspaceIdentity();
      const payload = await getBootstrap(user);
      return Response.json({ ...payload, authMode });
    } catch (retryError) {
      console.error("[bootstrap] retry error caught:", retryError instanceof Error ? (retryError.stack || retryError.message) : retryError);
      return apiErrorResponse(retryError || initialError);
    }
  }
}
