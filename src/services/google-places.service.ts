import PQueue from "p-queue";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { normalizePhone } from "../utils/phone.js";

/**
 * SerpAPI Google Maps — finds phone numbers for businesses
 * by searching Google Maps for their name + location.
 *
 * Free plan: 250 searches/month, 250 req/hour.
 * Each search returns up to 20 local results with phone numbers.
 */

interface SerpApiLocalResult {
  title: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
}

interface SerpApiPlaceResult {
  title: string;
  phone?: string;
  address?: string;
  website?: string;
  place_id?: string;
}

interface SerpApiResponse {
  local_results?: SerpApiLocalResult[];
  place_results?: SerpApiPlaceResult;
  search_metadata?: { status: string };
  error?: string;
}

// Rate limit: conservative — 1 req/s to stay within free tier
const serpQueue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: 1200,
});

const API_URL = "https://serpapi.com/search.json";

/**
 * Search Google Maps via SerpAPI for a business and return its phone number(s).
 * Uses razaoSocial + municipio + UF to build the query.
 *
 * Returns normalized E.164 phone strings, or empty array if not found.
 */
export async function findPhoneByGooglePlaces(
  razaoSocial: string,
  municipio?: string | null,
  uf?: string | null
): Promise<string[]> {
  const apiKey = env.SERPAPI_KEY;
  if (!apiKey) return [];

  // Build search query: "Empresa XYZ São Paulo SP"
  let query = razaoSocial;
  if (municipio) query += ` ${municipio}`;
  if (uf) query += ` ${uf}`;

  try {
    const result = await serpQueue.add(() =>
      searchGoogleMaps(apiKey, query)
    );
    return result ?? [];
  } catch (err: any) {
    logger.error(`SerpAPI error for "${razaoSocial}": ${err.message}`);
    return [];
  }
}

async function searchGoogleMaps(apiKey: string, query: string): Promise<string[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: query,
    type: "search",
    hl: "pt-br",
    gl: "br",
    api_key: apiKey,
  });

  const res = await fetch(`${API_URL}?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    logger.warn(`SerpAPI ${res.status}: ${await res.text().catch(() => "")}`);
    return [];
  }

  const data = (await res.json()) as SerpApiResponse;

  if (data.error) {
    logger.warn(`SerpAPI error: ${data.error}`);
    return [];
  }

  const phones: string[] = [];

  // When query is very specific, SerpAPI returns place_results (single match)
  if (data.place_results?.phone) {
    const normalized = normalizePhone(data.place_results.phone);
    if (normalized) phones.push(normalized);
    return phones;
  }

  // Otherwise, check local_results (multiple matches)
  if (!data.local_results || data.local_results.length === 0) return [];

  // Take phone from the first result (best match)
  const first = data.local_results[0];
  if (first.phone) {
    const normalized = normalizePhone(first.phone);
    if (normalized) phones.push(normalized);
  }

  // Also check 2nd result in case the 1st doesn't have a phone
  if (phones.length === 0 && data.local_results.length > 1) {
    const second = data.local_results[1];
    if (second.phone) {
      const normalized = normalizePhone(second.phone);
      if (normalized) phones.push(normalized);
    }
  }

  return phones;
}

/**
 * Batch lookup phones for multiple businesses via SerpAPI Google Maps.
 * Returns a Map of CNPJ → phone numbers found.
 *
 * Note: Free plan has 250 searches/month — use wisely.
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

  if (!env.SERPAPI_KEY) {
    logger.warn("SerpAPI key not configured, skipping Google Maps lookup");
    return results;
  }

  // Filter out businesses without razaoSocial (can't search without a name)
  const searchable = businesses.filter((b) => b.razaoSocial);

  logger.info(`SerpAPI Google Maps: searching ${searchable.length} businesses`);

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

  logger.info(`SerpAPI Google Maps: found phones for ${found}/${searchable.length} businesses`);
  return results;
}
