import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT id, lead_id, recipient_phone, recipient_name, status, sent_at
FROM whatsapp_send_log
WHERE sent_at > '2026-03-03T16:00:00'
ORDER BY id DESC
`);
console.log("Envios DEPOIS do deploy do lock (16:00+):", r.rows.length);
for (const row of r.rows) {
  const s = row as any;
  console.log(`  #${s.id} | Lead ${s.lead_id} | ${(s.recipient_name || "?").substring(0,30)} | ${s.recipient_phone} | ${s.status} | ${s.sent_at}`);
}

if (r.rows.length === 0) {
  console.log("\nNenhum envio novo — o job 182 (double-trigger) foi bloqueado pelo lock ou enviou apenas 1x.");
}

// Check job 182 runs
const runs = await db.execute(sql`
SELECT id, job_id, status, emails_found, emails_sent, started_at, completed_at
FROM automation_run_log
WHERE job_id = 182
ORDER BY id DESC
`);
console.log("\nRuns do job 182 (teste lock):", runs.rows.length);
for (const row of runs.rows) {
  const r2 = row as any;
  console.log(`  Run #${r2.id}: found=${r2.emails_found} sent=${r2.emails_sent} status=${r2.status} started=${r2.started_at}`);
}

process.exit(0);
