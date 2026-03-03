import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const r = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE fonte = 'pncp')::int as pncp,
  COUNT(*) FILTER (WHERE fonte = 'pncp_contratos')::int as contratos,
  COUNT(*) FILTER (WHERE fonte = 'diario_oficial')::int as diario,
  COUNT(*) FILTER (WHERE fonte = 'tce_sp')::int as tce_sp,
  COUNT(*) FILTER (WHERE fonte NOT IN ('pncp','pncp_contratos','diario_oficial','tce_sp'))::int as outros
FROM leads
`);
console.log(JSON.stringify(r.rows[0]));
process.exit(0);
