import { sql, eq } from "drizzle-orm";
import { db } from "../src/config/database.js";
import { leads } from "../src/db/schema.js";
import { findPhoneByGooglePlaces } from "../src/services/google-places.service.js";
import { mergePhones, isMobilePhone, parsePhoneList } from "../src/utils/phone.js";

/**
 * Bulk enrich leads with Google Places API.
 * Only targets leads that already have razão social but no phone.
 * Respects the 4,500/month limit built into the service.
 */

// Get current usage
const month = new Date().toISOString().slice(0, 7);
const key = `google_places_usage_${month}`;
let currentUsage = 0;
try {
  const r = await db.execute(sql`SELECT valor FROM config_kv WHERE chave = ${key}`);
  currentUsage = Number((r.rows[0] as any)?.valor ?? 0);
} catch { /* table may not exist */ }

console.log(`Google Places usage: ${currentUsage}/4500 this month`);
const remaining = 4500 - currentUsage;
if (remaining <= 0) {
  console.log("Monthly limit reached. Exiting.");
  process.exit(0);
}

// Get leads without phone that have razão social
const needsPhone = await db.execute(sql`
  SELECT id, cnpj, razao_social, municipio, uf
  FROM leads
  WHERE (telefones IS NULL OR telefones = '')
  AND length(cnpj) = 14
  AND razao_social IS NOT NULL AND razao_social != ''
  ORDER BY id DESC
  LIMIT ${remaining}
`);

const total = needsPhone.rows.length;
console.log(`Found ${total} leads to enrich (will use up to ${Math.min(total, remaining)} API calls)\n`);

let found = 0;
let empty = 0;
let errors = 0;
let processed = 0;

for (const row of needsPhone.rows) {
  const lead = row as any;
  processed++;

  try {
    const phones = await findPhoneByGooglePlaces(
      lead.razao_social,
      lead.municipio,
      lead.uf
    );

    if (phones.length > 0) {
      const nPhones = mergePhones(null, phones);
      const hasMob = nPhones ? parsePhoneList(nPhones).some(isMobilePhone) : false;
      await db.update(leads).set({
        telefones: nPhones,
        temCelular: hasMob,
      }).where(eq(leads.id, lead.id));
      found++;
      console.log(`✅ #${lead.id} | ${phones[0]} | ${(lead.razao_social || "").substring(0, 45)}`);
    } else {
      empty++;
    }
  } catch (err: any) {
    errors++;
    console.error(`❌ Error #${lead.id}: ${err.message}`);
  }

  // Progress every 100
  if (processed % 100 === 0) {
    console.log(`\n--- Progress: ${processed}/${total} | Found: ${found} | Empty: ${empty} | Errors: ${errors} ---\n`);
  }
}

console.log(`\n=== DONE ===`);
console.log(`Processed: ${processed}`);
console.log(`Found phones: ${found} (${(found/processed*100).toFixed(1)}%)`);
console.log(`Empty/no match: ${empty}`);
console.log(`Errors: ${errors}`);
console.log(`Total API calls used: ~${currentUsage + processed}`);

process.exit(0);
