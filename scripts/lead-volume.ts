import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// 1. Leads por fonte por dia (média últimos 7 dias)
const perFonteDay = await db.execute(sql`
SELECT
  COALESCE(fonte, 'sem_fonte') as fonte,
  COUNT(*)::int as total_7d,
  ROUND(COUNT(*)::numeric / 7, 1) as media_dia
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')
GROUP BY fonte
ORDER BY total_7d DESC
`);

console.log("=== VOLUME POR FONTE (últimos 7 dias) ===");
console.log("Fonte                | 7 dias | Média/dia | Projeção/mês");
console.log("---------------------|--------|-----------|------------");
let totalProj = 0;
for (const r of perFonteDay.rows) {
  const row = r as any;
  const projMes = Math.round(parseFloat(row.media_dia) * 30);
  totalProj += projMes;
  console.log(`${row.fonte.padEnd(21)}| ${String(row.total_7d).padStart(6)} | ${String(row.media_dia).padStart(9)} | ${String(projMes).padStart(10)}`);
}
console.log(`${"TOTAL".padEnd(21)}| ${""} | ${"".padStart(9)} | ${String(totalProj).padStart(10)}`);

// 2. Dedup rate (how many are rejected as duplicates)
const dupRate = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(DISTINCT cnpj)::int as unique_cnpj,
  COUNT(*) - COUNT(DISTINCT cnpj) as duplicados
FROM leads
`);
console.log("\n=== TAXA DE DUPLICAÇÃO ===");
const d = dupRate.rows[0] as any;
console.log(`Total leads: ${d.total} | CNPJs únicos: ${d.unique_cnpj} | Duplicatas: ${d.duplicados} (${(100*d.duplicados/d.total).toFixed(1)}%)`);

// 3. Jobs ativos por fonte (quantos jobs captam por fonte)
const jobsPerFonte = await db.execute(sql`
SELECT
  source_type,
  COUNT(*)::int as jobs,
  ROUND(AVG(interval_hours)::numeric, 1) as avg_interval,
  ROUND(AVG(search_quantity)::numeric, 0) as avg_qty
FROM automation_jobs
WHERE is_active = true AND job_type = 'populate_leads'
GROUP BY source_type
ORDER BY jobs DESC
`);
console.log("\n=== JOBS ATIVOS POR FONTE ===");
console.log("Fonte             | Jobs | Intervalo(h) | Qtd/busca");
for (const r of jobsPerFonte.rows) {
  const row = r as any;
  console.log(`${row.source_type.padEnd(18)}| ${String(row.jobs).padStart(4)} | ${String(row.avg_interval).padStart(12)} | ${String(row.avg_qty).padStart(9)}`);
}

// 4. New leads per week trend
const weekTrend = await db.execute(sql`
SELECT
  LEFT(created_at, 4) || '-W' || LPAD(EXTRACT(WEEK FROM created_at::timestamp)::text, 2, '0') as semana,
  COUNT(*)::int as novos,
  COUNT(DISTINCT fonte)::int as fontes_ativas
FROM leads
GROUP BY 1
ORDER BY 1 DESC
LIMIT 8
`);
console.log("\n=== TENDÊNCIA SEMANAL ===");
for (const r of weekTrend.rows) {
  const row = r as any;
  console.log(`${row.semana}: ${row.novos} leads (${row.fontes_ativas} fontes)`);
}

process.exit(0);
