import PQueue from "p-queue";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { normalizePhone } from "../utils/phone.js";

/**
 * Google Places API (New) — finds phone numbers for businesses
 * by searching for their name + location on Google Maps.
 *
 * Uses Text Search API which returns phone numbers directly,
 * avoiding the need for a separate Place Details call.
 *
 * Pricing: ~$35/1000 requests (Advanced fields tier for phone numbers)
 */

interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
}

interface TextSearchResponse {
  places?: PlaceResult[];
}

// Rate limit: 600 QPM (10 QPS) for Text Search
const placesQueue = new PQueue({
  concurrency: 3,
  intervalCap: 8,
  interval: 1000,
});

const API_URL = "https://places.googleapis.com/v1/places:searchText";

/**
 * Search Google Places for a business and return its phone number(s).
 * Uses razaoSocial + municipio + UF to build the query.
 *
 * Returns normalized E.164 phone strings, or empty array if not found.
 */
export async function findPhoneByGooglePlaces(
  razaoSocial: string,
  municipio?: string | null,
  uf?: string | null
): Promise<string[]> {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  // Build search query: "Empresa XYZ São Paulo SP"
  let query = razaoSocial;
  if (municipio) query += ` ${municipio}`;
  if (uf) query += ` ${uf}`;

  try {
    const result = await placesQueue.add(() =>
      searchPlaces(apiKey, query)
    );
    return result ?? [];
  } catch (err: any) {
    logger.error(`Google Places error for "${razaoSocial}": ${err.message}`);
    return [];
  }
}

async function searchPlaces(apiKey: string, query: string): Promise<string[]> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Request only the fields we need — phone fields are "Advanced" tier ($35/1k)
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn(`Google Places API ${res.status}: ${text.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as TextSearchResponse;
  if (!data.places || data.places.length === 0) return [];

  const place = data.places[0];
  const phones: string[] = [];

  // Try nationalPhoneNumber first (e.g. "(11) 99999-8888")
  if (place.nationalPhoneNumber) {
    const normalized = normalizePhone(place.nationalPhoneNumber);
    if (normalized) phones.push(normalized);
  }

  // Fallback to internationalPhoneNumber (e.g. "+55 11 99999-8888")
  if (phones.length === 0 && place.internationalPhoneNumber) {
    const normalized = normalizePhone(place.internationalPhoneNumber);
    if (normalized) phones.push(normalized);
  }

  return phones;
}

/**
 * Batch lookup phones for multiple businesses via Google Places.
 * Returns a Map of CNPJ → phone numbers found.
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
    logger.warn("Google Places API key not configured, skipping");
    return results;
  }

  // Filter out businesses without razaoSocial (can't search without a name)
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
