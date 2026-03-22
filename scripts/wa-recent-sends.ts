import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Last 15 sends
const recent = await db.execute(sql`
SELECT id, lead_id, recipient_phone, recipient_name, template_name, status, sent_at
FROM whatsapp_send_log
ORDER BY id DESC
LIMIT 15
`);

console.log("=== ÚLTIMOS 15 ENVIOS ===\n");
for (const row of recent.rows) {
  const s = row as any;
  const name = (s.recipient_name || "?").substring(0, 35).padEnd(37);
  console.log(`#${s.id} | Lead ${String(s.lead_id).padEnd(5)} | ${name} | ${s.recipient_phone} | ${s.status} | ${s.sent_at}`);
}

// Check if any phone got multiple sends in last hour
const recentDups = await db.execute(sql`
SELECT recipient_phone, COUNT(*)::int as qty
FROM whatsapp_send_log
WHERE sent_at >= NOW() - INTERVAL '2 hours'
GROUP BY recipient_phone
HAVING COUNT(*) > 1
`);
console.log("\n=== TELEFONES COM MÚLTIPLOS ENVIOS (últimas 2h) ===");
if (recentDups.rows.length === 0) {
  console.log("Nenhum! Lock funcionando corretamente.");
} else {
  for (const r of recentDups.rows) {
    const d = r as any;
    console.log(`  ${d.recipient_phone}: ${d.qty}x`);
  }
}

process.exit(0);
