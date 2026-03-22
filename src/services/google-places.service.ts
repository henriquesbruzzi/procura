import PQueue from "p-queue";
import { sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { normalizePhone } from "../utils/phone.js";

/**
 * Google Places API (New) — finds phone numbers for businesses
 * by searching Google Maps for their name + location.
 *
 * Free tier: 5,000 requests/month. Hard limit set to 4,500 to stay safe.
 * Counter persisted in DB to survive deploys.
 */

const MONTHLY_LIMIT = 4500;

interface PlaceResult {
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  displayName?: { text: string };
  formattedAddress?: string;
}

interface PlacesResponse {
  places?: PlaceResult[];
  error?: { message: string; status: string };
}

// Rate limit: 1 req/s
const placesQueue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: 1000,
});

const API_URL = "https://places.googleapis.com/v1/places:searchText";

// Persistent counter via DB
async function getMonthlyUsage(): Promise<number> {
  const month = new Date().toISOString().slice(0, 7); // "2026-03"
  const key = `google_places_usage_${month}`;
  try {
    const r = await db.execute(sql`
      SELECT valor FROM config_kv WHERE chave = ${key}
    `);
    return Number((r.rows[0] as any)?.valor ?? 0);
  } catch {
    // Table might not exist yet
    return 0;
  }
}

async function incrementUsage(): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  const key = `google_places_usage_${month}`;
  try {
    await db.execute(sql`
      INSERT INTO config_kv (chave, valor) VALUES (${key}, '1')
      ON CONFLICT (chave) DO UPDATE SET valor = (COALESCE(config_kv.valor::int, 0) + 1)::text
    `);
  } catch {
    // Ignore — counter is best-effort
  }
}

// Ensure config_kv table exists
let tableChecked = false;
async function ensureTable(): Promise<void> {
  if (tableChecked) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS config_kv (
        chave TEXT PRIMARY KEY,
        valor TEXT
      )
    `);
    tableChecked = true;
  } catch {
    tableChecked = true;
  }
}

/**
 * Extract significant words (4+ chars) from a business name, lowercased.
 * Strips common suffixes like LTDA, EIRELI, ME, EPP, SA, S/A etc.
 */
function extractWords(name: string): string[] {
  const stopWords = new Set(["ltda", "eireli", "me", "epp", "s.a", "s/a", "sa", "comercio", "servicos", "serviços", "comércio", "industria", "indústria", "empresa", "grupo"]);
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[\s\-.,/&]+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));
}

/**
 * Check if the Google Places result name is similar enough to the lead's razão social.
 * Returns true if at least one significant word matches.
 */
function isNameMatch(leadName: string, placeName: string): boolean {
  const leadWords = extractWords(leadName);
  const placeWords = extractWords(placeName);
  if (leadWords.length === 0 || placeWords.length === 0) return false;
  return leadWords.some(lw => placeWords.some(pw => pw.includes(lw) || lw.includes(pw)));
}

/**
 * Search Google Places for a business and return its phone number(s).
 */
export async function findPhoneByGooglePlaces(
  razaoSocial: string,
  municipio?: string | null,
  uf?: string | null
): Promise<string[]> {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  await ensureTable();

  // Check monthly limit
  const usage = await getMonthlyUsage();
  if (usage >= MONTHLY_LIMIT) {
    logger.warn(`Google Places: monthly limit reached (${usage}/${MONTHLY_LIMIT}), skipping`);
    return [];
  }

  let query = razaoSocial;
  if (municipio) query += ` ${municipio}`;
  if (uf) query += ` ${uf}`;

  try {
    const result = await placesQueue.add(() =>
      searchPlaces(apiKey, query, razaoSocial)
    );
    await incrementUsage();
    return result ?? [];
  } catch (err: any) {
    logger.error(`Google Places error for "${razaoSocial}": ${err.message}`);
    return [];
  }
}

async function searchPlaces(apiKey: string, query: string, razaoSocial: string): Promise<string[]> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.nationalPhoneNumber,places.internationalPhoneNumber,places.displayName",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "pt-BR",
      maxResultCount: 3,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    logger.warn(`Google Places ${res.status}: ${await res.text().catch(() => "")}`);
    return [];
  }

  const data = (await res.json()) as PlacesResponse;

  if (data.error) {
    logger.warn(`Google Places error: ${data.error.message}`);
    return [];
  }

  if (!data.places || data.places.length === 0) return [];

  // Try each result, but only accept if the name matches the lead
  for (const place of data.places) {
    const placeName = place.displayName?.text || "";
    if (!isNameMatch(razaoSocial, placeName)) {
      logger.debug(`Google Places: name mismatch "${razaoSocial}" vs "${placeName}", skipping`);
      continue;
    }

    const phone = place.internationalPhoneNumber || place.nationalPhoneNumber;
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized) return [normalized];
    }
  }

  return [];
}

/**
 * Batch lookup phones for multiple businesses via Google Places.
 */
export async function findPhonesByGooglePlacesBatch(
  businesses: Array<{
    cnpj: string;
    razaoSocial: string | null;
    municipio?: string | null;
    uf?: string | null;
  }>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (!env.GOOGLE_PLACES_API_KEY) {
    logger.warn("Google Places API key not configured, skipping phone lookup");
    return results;
  }

  const searchable = businesses.filter((b) => b.razaoSocial);
  logger.info(`Google Places: searching ${searchable.length} businesses`);

  let found = 0;
  for (const biz of searchable) {
    const phones = await findPhoneByGooglePlaces(
      biz.razaoSocial!,
      biz.municipio,
      biz.uf
    );

    if (phones.length > 0) {
      results.set(biz.cnpj, phones);
      found++;
    }
  }

  logger.info(`Google Places: found phones for ${found}/${searchable.length} businesses`);
  return results;
}
