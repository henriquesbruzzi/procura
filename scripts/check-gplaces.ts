import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Check if config_kv exists and has Google Places usage
try {
  const r = await db.execute(sql`SELECT * FROM config_kv`);
  console.log("config_kv entries:", r.rows.length);
  for (const row of r.rows) {
    const kv = row as any;
    console.log(`  ${kv.chave} = ${kv.valor}`);
  }
} catch(e: any) {
  console.log("config_kv table does not exist yet (Google Places not called yet)");
}

// Check recent leads that got phones enriched today
const enriched = await db.execute(sql`
SELECT id, cnpj, razao_social, telefones, updated_at
FROM leads
WHERE telefones IS NOT NULL
AND updated_at >= to_char(NOW() - INTERVAL '1 hour', 'YYYY-MM-DD')
ORDER BY updated_at DESC
LIMIT 10
`);
console.log("\nLeads enriched with phone (last 1h):", enriched.rows.length);
for (const row of enriched.rows) {
  const l = row as any;
  console.log(`  #${l.id} | ${(l.razao_social || "?").substring(0,35)} | ${l.telefones} | ${l.updated_at}`);
}

process.exit(0);
