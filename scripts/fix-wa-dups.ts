import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Fix leads that received duplicate WhatsApp messages
const result = await db.execute(sql`
UPDATE leads
SET whatsapp_sent_count = 1
WHERE whatsapp_sent_count > 1
RETURNING id, cnpj, razao_social, whatsapp_sent_count
`);

console.log(`Fixed ${result.rows.length} leads (set sent_count back to 1):`);
for (const r of result.rows) {
  const l = r as any;
  console.log(`  #${l.id} ${l.razao_social}`);
}

process.exit(0);
