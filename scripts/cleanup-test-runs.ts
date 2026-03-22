import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`DELETE FROM automation_run_log WHERE job_id IN (181, 182)`);
console.log("Deleted junk run logs from test jobs 181/182");

// Also delete the duplicate WA send logs from earlier test
const r2 = await db.execute(sql`
DELETE FROM whatsapp_send_log
WHERE id IN (
  SELECT id FROM whatsapp_send_log w
  WHERE EXISTS (
    SELECT 1 FROM whatsapp_send_log w2
    WHERE w2.lead_id = w.lead_id AND w2.id < w.id
    AND w2.template_name = w.template_name
  )
)
`);
console.log("Deleted duplicate WA send log entries");

process.exit(0);
