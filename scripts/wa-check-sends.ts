import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const rows = await db.execute(sql`
  SELECT id, lead_id, template_name, status, sent_at
  FROM whatsapp_send_log
  ORDER BY id DESC
  LIMIT 10
`);
console.log("=== ÚLTIMOS ENVIOS WhatsApp ===");
for (const r of rows.rows) console.log(JSON.stringify(r));

const today = new Date().toISOString().split("T")[0];
const todayCount = await db.execute(sql`
  SELECT COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE status='sent')::int as sent,
         COUNT(*) FILTER (WHERE status='failed')::int as failed
  FROM whatsapp_send_log
  WHERE sent_at LIKE ${today + "%"}
`);
console.log("\n=== HOJE ===");
console.log(JSON.stringify(todayCount.rows[0]));

process.exit(0);
