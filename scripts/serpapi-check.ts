import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// 1. Current phone stats
const stats = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_telefone,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_whatsapp
FROM leads
`);
console.log("=== STATS ATUAIS ===");
console.log(JSON.stringify(stats.rows[0]));

// 2. Leads that have phones in leads table but NOT in fornecedores cache
// These likely came from SerpAPI (Google Maps)
const serpApiCandidates = await db.execute(sql`
SELECT COUNT(*)::int as count
FROM leads l
LEFT JOIN fornecedores f ON l.cnpj = f.cnpj
WHERE l.telefones IS NOT NULL AND l.telefones != ''
  AND (f.telefones IS NULL OR f.telefones = '')
`);
console.log("\n=== LEADS COM TEL MAS SEM TEL NO CACHE (possível SerpAPI) ===");
console.log(JSON.stringify(serpApiCandidates.rows[0]));

// 3. Sample of these leads
const samples = await db.execute(sql`
SELECT l.cnpj, l.razao_social, l.telefones as lead_tel, l.municipio, l.uf,
       f.telefones as cache_tel
FROM leads l
LEFT JOIN fornecedores f ON l.cnpj = f.cnpj
WHERE l.telefones IS NOT NULL AND l.telefones != ''
  AND (f.telefones IS NULL OR f.telefones = '')
LIMIT 10
`);
console.log("\n=== AMOSTRAS (lead tem tel, cache não) ===");
for (const r of samples.rows) console.log(JSON.stringify(r));

// 4. Recent enrichments (leads that got phones in the last 24h)
// Check leads where telefones was updated recently via created_at of fornecedores
const recentEnrich = await db.execute(sql`
SELECT COUNT(*)::int as total_enriched_24h
FROM fornecedores
WHERE last_lookup_at > NOW() - INTERVAL '24 hours'
  AND telefones IS NOT NULL AND telefones != ''
`);
console.log("\n=== FORNECEDORES COM TEL (últimas 24h) ===");
console.log(JSON.stringify(recentEnrich.rows[0]));

// 5. Total leads with phones per day (approximation)
const phoneTrend = await db.execute(sql`
SELECT
  date_trunc('day', f.last_lookup_at::timestamp)::date as dia,
  COUNT(*)::int as lookups,
  COUNT(*) FILTER (WHERE f.telefones IS NOT NULL AND f.telefones != '')::int as com_tel
FROM fornecedores f
WHERE f.last_lookup_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC
LIMIT 5
`);
console.log("\n=== TREND LOOKUPS POR DIA ===");
for (const r of phoneTrend.rows) console.log(JSON.stringify(r));

process.exit(0);
