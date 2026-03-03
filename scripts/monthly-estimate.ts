import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// 1. Leads por dia (últimos 30 dias)
const perDay = await db.execute(sql`
SELECT
  LEFT(created_at, 10) as dia,
  COUNT(*)::int as novos
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
GROUP BY 1
ORDER BY 1 DESC
`);

console.log("=== LEADS NOVOS POR DIA (últimos 30 dias) ===");
let total30d = 0;
let dias = 0;
for (const r of perDay.rows) {
  const row = r as { dia: string; novos: number };
  total30d += row.novos;
  dias++;
  console.log(`${row.dia}: +${row.novos}`);
}
const mediaD = dias > 0 ? Math.round(total30d / dias) : 0;
console.log(`\nTotal 30d: ${total30d} | Dias ativos: ${dias} | Média/dia: ${mediaD}`);
console.log(`Estimativa mensal: ~${mediaD * 30} leads/mês`);

// 2. Leads por semana
const perWeek = await db.execute(sql`
SELECT
  LEFT(created_at, 4) || '-W' || LPAD(EXTRACT(WEEK FROM created_at::timestamp)::text, 2, '0') as semana,
  COUNT(*)::int as novos
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '60 days', 'YYYY-MM-DD')
GROUP BY 1
ORDER BY 1 DESC
`);
console.log("\n=== LEADS POR SEMANA ===");
for (const r of perWeek.rows) {
  const row = r as { semana: string; novos: number };
  console.log(`${row.semana}: +${row.novos}`);
}

// 3. Leads por fonte (últimos 30 dias)
const perFonte = await db.execute(sql`
SELECT
  COALESCE(fonte, 'sem_fonte') as fonte,
  COUNT(*)::int as novos_30d,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_wa
FROM leads
WHERE created_at >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
GROUP BY fonte
ORDER BY novos_30d DESC
`);
console.log("\n=== POR FONTE (últimos 30d) ===");
console.log("Fonte                    | Novos | C/Tel | C/WA");
for (const r of perFonte.rows) {
  const row = r as { fonte: string; novos_30d: number; com_tel: number; com_wa: number };
  console.log(`${row.fonte.padEnd(25)}| ${String(row.novos_30d).padStart(5)} | ${String(row.com_tel).padStart(5)} | ${String(row.com_wa).padStart(4)}`);
}

// 4. Funil completo
const funnel = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel,
  COUNT(*) FILTER (WHERE tem_celular = true)::int as com_cel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_wa,
  COUNT(*) FILTER (WHERE whatsapp_sent_count > 0)::int as wa_enviado,
  COUNT(*) FILTER (WHERE email_sent_count > 0)::int as email_enviado
FROM leads
`);
console.log("\n=== FUNIL COMPLETO ===");
const f = funnel.rows[0] as any;
console.log(`Total leads:        ${f.total}`);
console.log(`Com telefone:       ${f.com_tel} (${(100*f.com_tel/f.total).toFixed(1)}%)`);
console.log(`Com celular:        ${f.com_cel}`);
console.log(`Com WhatsApp:       ${f.com_wa} (${(100*f.com_wa/f.total).toFixed(1)}%)`);
console.log(`WA msg enviada:     ${f.wa_enviado}`);
console.log(`Email enviado:      ${f.email_enviado}`);

process.exit(0);
