import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError } from "@/server/errors";

export const SESSION_COOKIE = "frido_session";
const SESSION_TTL_DAYS = 7;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  role: "super_admin" | "employee";
  preferences: Record<string, unknown>;
};

export { ApiError, apiErrorResponse } from "@/server/errors";

export function assertEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (missing.length > 0) {
    throw new ApiError(500, `Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

import { hashPassword, verifyPassword } from "@/lib/password";
export { hashPassword, verifyPassword };

/* ---------------------------------------------------------------- sessions */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

const loadSessionUser = cache(async (): Promise<SessionUser | null> => {
  assertEnv();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      role: users.role,
      preferences: users.preferences,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    jobTitle: row.jobTitle,
    role: row.role,
    preferences: row.preferences ?? {},
  };
});

/**
 * Single-user workspace fallback.
 *
 * The login screen has been removed for this stage, so requests without a session resolve to
 * the active workspace owner (SUPER_ADMIN preferred). This keeps every audit trail, review
 * decision and report attributed to a real database user instead of a fake identity.
 * Re-enable enforced sessions by setting AUTH_REQUIRED=1 and restoring the /login route.
 */
const loadFallbackUser = cache(async (): Promise<SessionUser | null> => {
  assertEnv();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      role: users.role,
      preferences: users.preferences,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(sql`case when ${users.role} = 'super_admin' then 0 else 1 end`, asc(users.createdAt))
    .limit(1);

  const row = rows[0];
  if (row) {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      jobTitle: row.jobTitle,
      role: row.role,
      preferences: row.preferences ?? {},
    };
  }

  // If no user exists in the database (e.g. fresh database setup),
  // automatically create the primary workspace owner so that operations
  // have a real database user to attribute foreign keys and audit logs to.
  try {
    const [created] = await db
      .insert(users)
      .values({
        email: "admin@myfrido.com",
        passwordHash: hashPassword("Frido@2026"),
        displayName: "Aarav Mehta",
        jobTitle: "Product Operations Lead",
        role: "super_admin",
        preferences: {},
      })
      .returning();

    if (created) {
      return {
        id: created.id,
        email: created.email,
        displayName: created.displayName,
        jobTitle: created.jobTitle,
        role: created.role,
        preferences: created.preferences ?? {},
      };
    }
  } catch (err) {
    console.error("[auth] failed to auto-provision initial workspace owner:", err);
  }

  return null;
});

export function isAuthEnforced(): boolean {
  return process.env.AUTH_REQUIRED === "1";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    return await loadSessionUser();
  } catch (error) {
    console.error("[auth] session lookup failed", error);
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const sessionUser = await getSessionUser();
  if (sessionUser) return sessionUser;

  if (isAuthEnforced()) throw new ApiError(401, "Authentication required");

  const fallback = await loadFallbackUser();
  if (!fallback) {
    throw new ApiError(
      503,
      "Workspace not initialised: no active users found. Run `npx tsx src/db/seed.ts` to create the workspace owner."
    );
  }
  return fallback;
}

/** Which identity the workspace is operating as, for the bootstrap payload. */
export async function getWorkspaceIdentity(): Promise<{
  user: SessionUser;
  authMode: "single_user" | "session";
}> {
  const sessionUser = await getSessionUser();
  if (sessionUser) return { user: sessionUser, authMode: "session" };
  return { user: await requireUser(), authMode: "single_user" };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "super_admin") {
    throw new ApiError(403, "This action requires the SUPER_ADMIN role");
  }
  return user;
}

