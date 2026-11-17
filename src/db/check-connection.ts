import { pool } from "./index";

async function checkConnection() {
  const rawUrl = process.env.DATABASE_URL || "";
  const masked = rawUrl.replace(/:([^:@]+)@/, ":****@");
  console.log("[db-check] Testing connection to:", masked);

  try {
    const client = await pool.connect();
    console.log("[db-check] Pool connected successfully!");

    const tables = [
      "users",
      "sessions",
      "sticker_documents",
      "sticker_references",
      "product_family_mappings",
      "csv_batches",
      "imported_products",
      "match_results",
      "review_decisions",
      "audit_events",
      "reports",
      "processing_runs",
    ];

    console.log("[db-check] Row counts:");
    for (const table of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM "${table}";`);
      console.log(`  - ${table}: ${res.rows[0].count}`);
    }

    client.release();
    process.exit(0);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[db-check] Query failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void checkConnection();
