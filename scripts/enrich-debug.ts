import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

// Check leads without phone
const stats = await db.execute(sql`
SELECT
  COUNT(*)::int as total_sem_phone,
  COUNT(CASE WHEN razao_social IS NOT NULL AND razao_social != '' THEN 1 END)::int as com_razao,
  COUNT(CASE WHEN razao_social IS NULL OR razao_social = '' THEN 1 END)::int as sem_razao
FROM leads
WHERE (telefones IS NULL OR telefones = '')
AND length(cnpj) = 14
`);
const s = stats.rows[0] as any;
console.log("Leads sem telefone:", s.total_sem_phone);
console.log("  Com razão social:", s.com_razao, "(Google Places pode buscar)");
console.log("  Sem razão social:", s.sem_razao, "(só CNPJ lookup)");

// Show sample of leads that Google Places should try
const sample = await db.execute(sql`
SELECT id, cnpj, razao_social, municipio, uf
FROM leads
WHERE (telefones IS NULL OR telefones = '')
AND length(cnpj) = 14
AND razao_social IS NOT NULL AND razao_social != ''
ORDER BY id DESC
LIMIT 5
`);
console.log("\nAmostra de leads com razão social (candidatos Google Places):");
for (const row of sample.rows) {
  const l = row as any;
  console.log(`  #${l.id} | ${l.cnpj} | ${(l.razao_social || "").substring(0,40)} | ${l.municipio}/${l.uf}`);
}

// Check config_kv for current usage
const kv = await db.execute(sql`SELECT * FROM config_kv`);
console.log("\nGoogle Places usage:");
for (const row of kv.rows) {
  const k = row as any;
  console.log(`  ${k.chave} = ${k.valor}`);
}

process.exit(0);
