import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows: [stats] } = await client.query(`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE area_juridica IS NOT NULL) as backfilled,
        count(*) FILTER (WHERE area_juridica IS NULL) as pending
      FROM leads
    `);
    console.log("Backfill status:", stats);

    const { rows: dist } = await client.query(`
      SELECT area_juridica, motivo_lead, count(*) as total
      FROM leads WHERE area_juridica IS NOT NULL
      GROUP BY area_juridica, motivo_lead ORDER BY total DESC
    `);
    console.log("\nDistribuição:");
    for (const d of dist) console.log(`  ${d.area_juridica} / ${d.motivo_lead}: ${d.total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
