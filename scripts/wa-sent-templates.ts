import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT
  template_name,
  message_text,
  COUNT(*)::int as qty,
  MIN(sent_at) as first_sent,
  MAX(sent_at) as last_sent
FROM whatsapp_send_log
GROUP BY template_name, message_text
ORDER BY qty DESC
`);

console.log("=== TEMPLATES ENVIADOS ===\n");
for (const row of r.rows) {
  const t = row as any;
  console.log(`Template: ${t.template_name} (${t.qty}x)`);
  console.log(`  Período: ${t.first_sent} -> ${t.last_sent}`);
  console.log(`  Texto: ${t.message_text.substring(0, 120)}...`);
  console.log();
}

// Also show recent sends
const recent = await db.execute(sql`
SELECT
  id, lead_id, recipient_phone, recipient_name, template_name,
  message_text, status, sent_at
FROM whatsapp_send_log
ORDER BY id DESC
LIMIT 10
`);

console.log("=== ÚLTIMOS 10 ENVIOS ===\n");
for (const row of recent.rows) {
  const s = row as any;
  console.log(`#${s.id} | Lead ${s.lead_id} | ${s.recipient_name?.substring(0,30)} | ${s.recipient_phone} | ${s.template_name} | ${s.status} | ${s.sent_at}`);
}

process.exit(0);
