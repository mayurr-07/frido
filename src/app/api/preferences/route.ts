import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiErrorResponse, ApiError, requireUser } from "@/server/auth";
import { updateUserPreferences } from "@/server/repository";

export const dynamic = "force-dynamic";

const preferencesSchema = z
  .object({
    tableDensity: z.enum(["comfortable", "compact"]).optional(),
    defaultPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]).optional(),
    showDemoBanner: z.boolean().optional(),
    emailDigestEnabled: z.boolean().optional(),
    conflictAlertsEnabled: z.boolean().optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    roleTitle: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(422, "Invalid preferences payload", parsed.error.flatten());
    }

    const { displayName, roleTitle, email, ...preferenceValues } = parsed.data;

    if (email && email !== user.email) {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0 && existing[0].id !== user.id) {
        throw new ApiError(409, "That email address is already in use");
      }
    }

    if (displayName || roleTitle || email) {
      await db
        .update(users)
        .set({
          ...(displayName ? { displayName } : {}),
          ...(roleTitle ? { jobTitle: roleTitle } : {}),
          ...(email ? { email } : {}),
        })
        .where(eq(users.id, user.id));
    }

    const merged = await updateUserPreferences(user, preferenceValues);
    return Response.json({ ok: true, preferences: merged });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
