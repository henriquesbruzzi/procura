import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Check how many leads got phones from SerpAPI (phones in leads but NOT in fornecedores cache)
const impact = await db.execute(sql`
SELECT
  COUNT(*)::int as leads_com_tel_sem_cache,
  COUNT(*) FILTER (WHERE l.tem_whatsapp = true)::int as com_whatsapp,
  COUNT(*) FILTER (WHERE l.tem_celular = true)::int as com_celular
FROM leads l
LEFT JOIN fornecedores f ON l.cnpj = f.cnpj
WHERE l.telefones IS NOT NULL AND l.telefones != ''
  AND (f.telefones IS NULL OR f.telefones = '')
`);
console.log("=== LEADS COM TEL VIA SERPAPI (sem tel no cache CNPJ) ===");
console.log(JSON.stringify(impact.rows[0]));

// Compare: enriched in the last 24h
const recent = await db.execute(sql`
SELECT
  COUNT(*)::int as total_com_tel,
  COUNT(*) FILTER (WHERE f.telefones IS NOT NULL AND f.telefones != '')::int as cache_com_tel,
  COUNT(*) FILTER (WHERE f.telefones IS NULL OR f.telefones = '')::int as cache_sem_tel
FROM leads l
LEFT JOIN fornecedores f ON l.cnpj = f.cnpj
WHERE l.telefones IS NOT NULL AND l.telefones != ''
`);
console.log("\n=== LEADS COM TEL: CACHE vs SEM CACHE ===");
console.log(JSON.stringify(recent.rows[0]));

// Overall enrichment stats
const overall = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_wa,
  COUNT(*) FILTER (WHERE tem_celular = true)::int as com_cel,
  ROUND(100.0 * COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '') / COUNT(*), 1) as pct_tel,
  ROUND(100.0 * COUNT(*) FILTER (WHERE tem_whatsapp = true) / COUNT(*), 1) as pct_wa
FROM leads
`);
console.log("\n=== PANORAMA GERAL ===");
console.log(JSON.stringify(overall.rows[0]));

process.exit(0);
