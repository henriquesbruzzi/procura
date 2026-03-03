import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// 1. Leads with whatsapp_sent_count > 1
const dups = await db.execute(sql`
SELECT id, cnpj, razao_social, telefones, whatsapp_sent_count
FROM leads
WHERE whatsapp_sent_count > 1
ORDER BY whatsapp_sent_count DESC
`);
console.log("=== LEADS COM MAIS DE 1 ENVIO ===");
console.log("Total:", dups.rows.length);
for (const r of dups.rows) {
  const l = r as any;
  console.log(`  #${l.id} | ${(l.razao_social || "?").substring(0, 40)} | ${l.telefones} | sent=${l.whatsapp_sent_count}`);
}

// 2. Same phone in multiple leads that received messages
const phoneDups = await db.execute(sql`
SELECT telefones, COUNT(*)::int as qty,
  array_agg(id ORDER BY id) as lead_ids,
  SUM(whatsapp_sent_count)::int as total_sent
FROM leads
WHERE whatsapp_sent_count > 0 AND telefones IS NOT NULL
GROUP BY telefones
HAVING COUNT(*) > 1 OR SUM(whatsapp_sent_count) > 1
ORDER BY total_sent DESC
`);
console.log("\n=== TELEFONES COM ENVIO DUPLICADO ===");
console.log("Total:", phoneDups.rows.length);
for (const r of phoneDups.rows) {
  const p = r as any;
  console.log(`  ${p.telefones} | ${p.qty} leads (IDs: ${p.lead_ids}) | total enviados: ${p.total_sent}`);
}

// 3. Check the specific number from screenshot
const specific = await db.execute(sql`
SELECT id, cnpj, razao_social, telefones, whatsapp_sent_count, motivo_lead, fonte
FROM leads
WHERE telefones LIKE '%97205%'
`);
console.log("\n=== NÚMERO DA SCREENSHOT (+55 21 97205-5166) ===");
for (const r of specific.rows) {
  const l = r as any;
  console.log(`  #${l.id} | ${l.razao_social} | ${l.telefones} | sent=${l.whatsapp_sent_count} | fonte=${l.fonte} | motivo=${l.motivo_lead}`);
}

process.exit(0);
