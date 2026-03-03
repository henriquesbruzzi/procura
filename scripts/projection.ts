import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// 1. Current conversion rates
const rates = await db.execute(sql`
SELECT
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_wa,
  COUNT(*) FILTER (WHERE email_sent_count > 0)::int as email_enviado,
  COUNT(*) FILTER (WHERE whatsapp_sent_count > 0)::int as wa_enviado
FROM leads
`);
const r = rates.rows[0] as any;

// 2. CNPJ API hit rate (fornecedores with phones / total lookups)
const cnpjRate = await db.execute(sql`
SELECT
  COUNT(*)::int as total_lookups,
  COUNT(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')::int as com_tel
FROM fornecedores
WHERE last_lookup_at IS NOT NULL
`);
const c = cnpjRate.rows[0] as any;

// 3. SerpAPI contribution (leads with phone but not in cache)
const serpApi = await db.execute(sql`
SELECT COUNT(*)::int as serp_phones
FROM leads l
LEFT JOIN fornecedores f ON l.cnpj = f.cnpj
WHERE l.telefones IS NOT NULL AND l.telefones != ''
  AND (f.telefones IS NULL OR f.telefones = '')
`);
const s = serpApi.rows[0] as any;

// 4. WA conversion rate among leads WITH phones
const waRate = await db.execute(sql`
SELECT
  COUNT(*)::int as com_tel,
  COUNT(*) FILTER (WHERE tem_whatsapp = true)::int as com_wa
FROM leads
WHERE telefones IS NOT NULL AND telefones != ''
`);
const w = waRate.rows[0] as any;

console.log("======= TAXAS DE CONVERSÃO ATUAIS =======\n");
console.log(`Total leads:              ${r.total}`);
console.log(`CNPJ lookups feitos:      ${c.total_lookups}`);
console.log(`CNPJ com telefone:        ${c.com_tel} (${(100*c.com_tel/c.total_lookups).toFixed(1)}% hit rate)`);
console.log(`SerpAPI telefones:        ${s.serp_phones} (de 250 buscas = ${(100*s.serp_phones/250).toFixed(1)}% hit rate)`);
console.log(`Tel → WhatsApp:           ${w.com_wa}/${w.com_tel} = ${(100*w.com_wa/w.com_tel).toFixed(1)}%`);

const cnpjHitRate = c.com_tel / c.total_lookups;
const serpHitRate = s.serp_phones / 250;
const waConvRate = w.com_wa / w.com_tel;
const leadsPerMonth = 10000;

console.log("\n======= PROJEÇÃO MENSAL (10.000 leads/mês) =======\n");

// Scenario 1: Free only (CNPJ APIs + SerpAPI free 250)
const free_cnpj_phones = Math.round(leadsPerMonth * cnpjHitRate);
const free_serp_phones = Math.round(250 * serpHitRate);
const free_total_phones = free_cnpj_phones + free_serp_phones;
const free_wa = Math.round(free_total_phones * waConvRate);

console.log("--- CENÁRIO 1: 100% GRÁTIS (CNPJ APIs + SerpAPI free) ---");
console.log(`  Leads captados:      ${leadsPerMonth.toLocaleString()}`);
console.log(`  Tel via CNPJ APIs:   ${free_cnpj_phones.toLocaleString()} (${(100*cnpjHitRate).toFixed(1)}%)`);
console.log(`  Tel via SerpAPI:     +${free_serp_phones} (250 buscas grátis)`);
console.log(`  Total com telefone:  ${free_total_phones.toLocaleString()}`);
console.log(`  Com WhatsApp:        ${free_wa}`);
console.log(`  Custo:               $0/mês`);

// Scenario 2: Google Places free tier (5000 searches)
const gp_free_searches = 5000;
const gp_free_no_phone = leadsPerMonth - free_cnpj_phones;
const gp_free_actual = Math.min(gp_free_searches, gp_free_no_phone);
const gp_free_phones = Math.round(gp_free_actual * serpHitRate); // same ~60% hit rate as SerpAPI
const gp_free_total = free_cnpj_phones + gp_free_phones;
const gp_free_wa = Math.round(gp_free_total * waConvRate);

console.log("\n--- CENÁRIO 2: GOOGLE PLACES (free tier $0) ---");
console.log(`  Leads captados:      ${leadsPerMonth.toLocaleString()}`);
console.log(`  Tel via CNPJ APIs:   ${free_cnpj_phones.toLocaleString()}`);
console.log(`  Tel via Google Maps: +${gp_free_phones.toLocaleString()} (${gp_free_actual.toLocaleString()} buscas grátis)`);
console.log(`  Total com telefone:  ${gp_free_total.toLocaleString()}`);
console.log(`  Com WhatsApp:        ${gp_free_wa.toLocaleString()}`);
console.log(`  Custo:               $0/mês`);

// Scenario 3: Google Places paid (search ALL remaining)
const gp_paid_no_phone = leadsPerMonth - free_cnpj_phones;
const gp_paid_phones = Math.round(gp_paid_no_phone * serpHitRate);
const gp_paid_total = free_cnpj_phones + gp_paid_phones;
const gp_paid_wa = Math.round(gp_paid_total * waConvRate);
const gp_paid_extra = Math.max(0, gp_paid_no_phone - 5000);
const gp_paid_cost = Math.round(gp_paid_extra * 0.032);

console.log("\n--- CENÁRIO 3: GOOGLE PLACES (pago, busca TODOS) ---");
console.log(`  Leads captados:      ${leadsPerMonth.toLocaleString()}`);
console.log(`  Tel via CNPJ APIs:   ${free_cnpj_phones.toLocaleString()}`);
console.log(`  Tel via Google Maps: +${gp_paid_phones.toLocaleString()} (${gp_paid_no_phone.toLocaleString()} buscas)`);
console.log(`  Total com telefone:  ${gp_paid_total.toLocaleString()}`);
console.log(`  Com WhatsApp:        ${gp_paid_wa.toLocaleString()}`);
console.log(`  Custo:               ~$${gp_paid_cost}/mês (${gp_paid_extra.toLocaleString()} buscas extras × $0.032)`);

// Scenario 4: SerpAPI paid (5000 searches)
const serp_paid_phones = Math.round(5000 * serpHitRate);
const serp_paid_total = free_cnpj_phones + serp_paid_phones;
const serp_paid_wa = Math.round(serp_paid_total * waConvRate);

console.log("\n--- CENÁRIO 4: SERPAPI PAGO ($75/mês) ---");
console.log(`  Leads captados:      ${leadsPerMonth.toLocaleString()}`);
console.log(`  Tel via CNPJ APIs:   ${free_cnpj_phones.toLocaleString()}`);
console.log(`  Tel via SerpAPI:     +${serp_paid_phones.toLocaleString()} (5.000 buscas)`);
console.log(`  Total com telefone:  ${serp_paid_total.toLocaleString()}`);
console.log(`  Com WhatsApp:        ${serp_paid_wa.toLocaleString()}`);
console.log(`  Custo:               $75/mês`);

console.log("\n======= RESUMO =======\n");
console.log("Cenário              | Custo   | Telefones | WhatsApp | WA/mês extra");
console.log("---------------------|---------|-----------|----------|------------");
console.log(`1. 100% Grátis       | $0      | ${String(free_total_phones).padStart(5)}     | ${String(free_wa).padStart(5)}    | baseline`);
console.log(`2. Google Free       | $0      | ${String(gp_free_total).padStart(5)}     | ${String(gp_free_wa).padStart(5)}    | +${gp_free_wa - free_wa}`);
console.log(`3. Google Pago       | $${String(gp_paid_cost).padStart(3)}    | ${String(gp_paid_total).padStart(5)}     | ${String(gp_paid_wa).padStart(5)}    | +${gp_paid_wa - free_wa}`);
console.log(`4. SerpAPI Pago      | $75     | ${String(serp_paid_total).padStart(5)}     | ${String(serp_paid_wa).padStart(5)}    | +${serp_paid_wa - free_wa}`);

process.exit(0);
