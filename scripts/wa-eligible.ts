import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT COUNT(*)::int as total FROM leads
WHERE tem_whatsapp = true AND whatsapp_sent_count = 0 AND telefones IS NOT NULL
`);
console.log("Eligible for WA send:", (r.rows[0] as any).total);

// Show first 3
const sample = await db.execute(sql`
SELECT id, cnpj, razao_social, telefones, whatsapp_sent_count
FROM leads
WHERE tem_whatsapp = true AND whatsapp_sent_count = 0 AND telefones IS NOT NULL
ORDER BY id
LIMIT 3
`);
for (const row of sample.rows) {
  const l = row as any;
  console.log(`  #${l.id} | ${l.razao_social} | ${l.telefones} | sent=${l.whatsapp_sent_count}`);
}

process.exit(0);
