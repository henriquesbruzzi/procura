import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT id, lead_id, recipient_phone, recipient_name, template_name, message_text, status, sent_at
FROM whatsapp_send_log
ORDER BY id DESC
LIMIT 3
`);

for (const row of r.rows) {
  const s = row as any;
  console.log(`#${s.id} | ${(s.recipient_name || "?").substring(0, 35)} | ${s.recipient_phone} | ${s.status} | ${s.sent_at}`);
  console.log(`  Msg: ${s.message_text}`);
  console.log();
}

process.exit(0);
