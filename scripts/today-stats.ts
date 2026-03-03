import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Leads added TODAY
const today = await db.execute(sql`
SELECT
  fonte,
  COUNT(*)::int as novos
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '1 day', 'YYYY-MM-DD')
GROUP BY fonte
ORDER BY novos DESC
`);
console.log("=== LEADS ADICIONADOS HOJE ===");
let totalToday = 0;
for (const r of today.rows) {
  const row = r as any;
  totalToday += row.novos;
  console.log(`${row.fonte}: +${row.novos}`);
}
console.log(`TOTAL HOJE: +${totalToday}`);
console.log(`Projeção mensal (x30): ~${totalToday * 30} leads/mês`);

// Per-day last 7 days
const daily = await db.execute(sql`
SELECT
  LEFT(created_at, 10) as dia,
  COUNT(*)::int as novos
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')
GROUP BY 1
ORDER BY 1 DESC
`);
console.log("\n=== POR DIA (últimos 7) ===");
for (const r of daily.rows) {
  const row = r as any;
  console.log(`${row.dia}: +${row.novos}`);
}

process.exit(0);
