import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  csvBatches,
  importedProducts,
  matchResults,
  stickerDocuments,
  stickerReferences,
  users,
} from "@/db/schema";
import { apiErrorResponse, ApiError, requireUser, getWorkspaceIdentity } from "@/server/auth";
import { hydrateMatchRows, productSelect, resolveBatch } from "@/server/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    await requireUser();
    await getWorkspaceIdentity();

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const batchId = searchParams.get("batchId")?.trim();
    if (!batchId) {
      throw new ApiError(422, "batchId query parameter is required");
    }

    const tResolveStart = performance.now();
    const resolved = await resolveBatch(batchId);
    const tResolve = (performance.now() - tResolveStart).toFixed(1);

    if (!resolved) {
      throw new ApiError(404, "Batch not found");
    }

    const rawPage = searchParams.get("page");
    const rawPageSize = searchParams.get("pageSize");
    const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;
    const pageSize = rawPageSize ? Math.min(100, Math.max(1, parseInt(rawPageSize, 10) || 20)) : 20;

    const status = searchParams.get("status")?.trim();
    const q = searchParams.get("q")?.trim();

    // 1. Full-batch aggregations (not limited to page or status/q filters)
    const tAggStart = performance.now();
    const [aggRow] = await db
      .select({
        confirmed: sql<number>`count(*) filter (where ${matchResults.status} = 'confirmed')::int`,
        needs_review: sql<number>`count(*) filter (where ${matchResults.status} = 'needs_review')::int`,
        conflict: sql<number>`count(*) filter (where ${matchResults.status} = 'conflict')::int`,
        unmatched: sql<number>`count(*) filter (where ${matchResults.status} = 'unmatched')::int`,
        all: sql<number>`count(*)::int`,
      })
      .from(matchResults)
      .where(eq(matchResults.batchId, resolved.batch.id));
    const tAgg = (performance.now() - tAggStart).toFixed(1);

    const aggregations = {
      confirmed: aggRow?.confirmed ?? 0,
      needs_review: aggRow?.needs_review ?? 0,
      conflict: aggRow?.conflict ?? 0,
      unmatched: aggRow?.unmatched ?? 0,
      all: aggRow?.all ?? 0,
    };
    const total = aggregations.all;

    // 2. Build dynamic where conditions
    const conditions = [eq(matchResults.batchId, resolved.batch.id)];

    const validStatuses = ["confirmed", "needs_review", "conflict", "unmatched"];
    if (status && validStatuses.includes(status)) {
      conditions.push(eq(matchResults.status, status as "confirmed" | "needs_review" | "conflict" | "unmatched"));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(importedProducts.productCode, pattern),
          ilike(importedProducts.name, pattern),
          ilike(stickerReferences.stickerIdentifier, pattern)
        )!
      );
    }

    // 3. Filtered count
    const tCountStart = performance.now();
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchResults)
      .innerJoin(importedProducts, eq(matchResults.productId, importedProducts.id))
      .leftJoin(stickerReferences, eq(matchResults.stickerId, stickerReferences.id))
      .where(and(...conditions));
    const tCount = (performance.now() - tCountStart).toFixed(1);

    const filteredCount = countRow?.count ?? 0;

    // 4. Fetch paginated data
    const tFetchStart = performance.now();
    const rows = await db
      .select(productSelect)
      .from(matchResults)
      .innerJoin(csvBatches, eq(matchResults.batchId, csvBatches.id))
      .innerJoin(importedProducts, eq(matchResults.productId, importedProducts.id))
      .leftJoin(stickerReferences, eq(matchResults.stickerId, stickerReferences.id))
      .leftJoin(stickerDocuments, eq(stickerReferences.documentId, stickerDocuments.id))
      .leftJoin(users, eq(matchResults.reviewedBy, users.id))
      .where(and(...conditions))
      .orderBy(asc(importedProducts.rowNumber))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const tHydrateStart = performance.now();
    const data = await hydrateMatchRows(rows);
    const tHydrate = (performance.now() - tHydrateStart).toFixed(1);
    const tFetch = (performance.now() - tFetchStart).toFixed(1);

    const totalDuration = (performance.now() - start).toFixed(1);
    console.log(
      `[timing] GET /api/matches batch=${resolved.batch.batchCode} total=${totalDuration}ms (resolve=${tResolve}ms, agg=${tAgg}ms, count=${tCount}ms, fetch=${tFetch}ms [hydrate=${tHydrate}ms], rows=${data.length})`
    );

    return Response.json({
      data,
      total,
      filteredCount,
      page,
      pageSize,
      aggregations,
    });
  } catch (error) {
    const totalDuration = (performance.now() - start).toFixed(1);
    console.error(
      `[timing] GET /api/matches failed after ${totalDuration}ms:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return apiErrorResponse(error);
  }
}
