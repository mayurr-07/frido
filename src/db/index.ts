import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[db] DATABASE_URL environment variable is missing.");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlUrl?: string;
};

const isSslRequired = Boolean(
  databaseUrl &&
    (databaseUrl.includes("sslmode=require") ||
      databaseUrl.includes("neon.tech") ||
      process.env.NODE_ENV === "production")
);

function createPool(url: string | undefined): Pool {
  const p = new Pool({
    connectionString: url,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
    max: 10,
    maxUses: 1, // Cloudflare Workers: avoid reusing TCP sockets across different request lifecycles
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 15000,
  });

  p.on("error", (err) => {
    // Neon serverless suspends compute on idle, closing idle connections.
    // Handled here so it doesn't cause unhandled error crashes.
    console.warn("[db] pool idle client warning:", err.message);
  });

  return p;
}

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool &&
  globalForDb.__arenaNextJsPostgresqlUrl === databaseUrl
    ? globalForDb.__arenaNextJsPostgresqlPool
    : createPool(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  globalForDb.__arenaNextJsPostgresqlUrl = databaseUrl;
}

export const db = drizzle(pool);
