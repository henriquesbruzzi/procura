import { sql } from "drizzle-orm";
import { db } from "../src/config/database.js";

const API_URL = "https://places.googleapis.com/v1/places:searchText";
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "AIzaSyAqTngMZWklgPo7pQ3Dh7N2xNhXa4nEvJ8";

// Get 30 random leads without phone
const r = await db.execute(sql`
SELECT id, cnpj, razao_social, municipio, uf
FROM leads
WHERE (telefones IS NULL OR telefones = '')
AND length(cnpj) = 14
AND razao_social IS NOT NULL AND razao_social != ''
ORDER BY RANDOM()
LIMIT 30
`);

const leads = r.rows as any[];
console.log(`Testing ${leads.length} leads against Google Places API...\n`);

let found = 0;
let empty = 0;
let wrong = 0;

for (const lead of leads) {
  const query = `${lead.razao_social} ${lead.municipio || ""} ${lead.uf || ""}`.trim();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", maxResultCount: 1 }),
  });

  const data = await res.json() as any;
  const place = data.places?.[0];
  const phone = place?.internationalPhoneNumber || place?.nationalPhoneNumber;
  const name = place?.displayName?.text || "";

  if (!place || !phone) {
    empty++;
    console.log(`❌ VAZIO | ${(lead.razao_social || "").substring(0, 45)} | ${lead.municipio}/${lead.uf}`);
  } else {
    // Simple name similarity check
    const leadWords = lead.razao_social.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const placeWords = name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const match = leadWords.some((w: string) => placeWords.some((p: string) => p.includes(w) || w.includes(p)));

    if (match) {
      found++;
      console.log(`✅ MATCH | ${phone} | ${(lead.razao_social || "").substring(0, 35)} → ${name.substring(0, 35)}`);
    } else {
      wrong++;
      console.log(`⚠️ WRONG | ${phone} | ${(lead.razao_social || "").substring(0, 35)} → ${name.substring(0, 35)}`);
    }
  }

  // Rate limit: 1 req/s
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`\n--- RESULTADO ---`);
console.log(`Total testados: ${leads.length}`);
console.log(`✅ Match (telefone correto): ${found} (${(found/leads.length*100).toFixed(1)}%)`);
console.log(`⚠️ Wrong (empresa errada):   ${wrong} (${(wrong/leads.length*100).toFixed(1)}%)`);
console.log(`❌ Vazio (sem resultado):     ${empty} (${(empty/leads.length*100).toFixed(1)}%)`);
console.log(`\nHit rate real estimado: ${(found/leads.length*100).toFixed(1)}%`);

// Also show total leads without phone for projection
const total = await db.execute(sql`
SELECT
  COUNT(*)::int as sem_phone_total,
  COUNT(CASE WHEN razao_social IS NOT NULL AND razao_social != '' THEN 1 END)::int as com_razao
FROM leads
WHERE (telefones IS NULL OR telefones = '')
AND length(cnpj) = 14
`);
const t = total.rows[0] as any;
const projectedPhones = Math.round(t.com_razao * found / leads.length);
console.log(`\nLeads sem telefone: ${t.sem_phone_total} (${t.com_razao} com razão social)`);
console.log(`Projeção: ~${projectedPhones} telefones recuperáveis via Google Places`);

process.exit(0);
