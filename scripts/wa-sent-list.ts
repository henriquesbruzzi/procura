import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT
  id, cnpj, razao_social, telefones, municipio, uf,
  whatsapp_sent_count, area_juridica, motivo_lead
FROM leads
WHERE whatsapp_sent_count > 0
ORDER BY id DESC
LIMIT 25
`);

console.log("=== LEADS QUE RECEBERAM WHATSAPP ===\n");
for (const row of r.rows) {
  const l = row as any;
  const nome = (l.razao_social || "?").substring(0, 40).padEnd(42);
  const tel = (l.telefones || "?").padEnd(20);
  const loc = `${l.municipio || "?"}/${l.uf || "?"}`;
  console.log(`#${l.id} | ${nome} | ${tel} | ${loc.padEnd(20)} | msgs: ${l.whatsapp_sent_count} | ${l.motivo_lead || "-"}`);
}
console.log(`\nTotal com envio: ${r.rows.length}`);

process.exit(0);
