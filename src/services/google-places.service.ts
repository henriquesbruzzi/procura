import PQueue from "p-queue";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { normalizePhone } from "../utils/phone.js";

/**
 * Google Places API (New) — finds phone numbers for businesses
 * by searching Google Maps for their name + location.
 *
 * Free tier: 5,000 requests/month, then $32/1,000.
 */

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

// Rate limit: 1 req/s to be safe
const placesQueue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
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

  const phones: string[] = [];

  // Take phone from first result (best match)
  const first = data.places[0];
  const phone = first.internationalPhoneNumber || first.nationalPhoneNumber;
  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) phones.push(normalized);
  }

  // Fallback to 2nd result if first has no phone
  if (phones.length === 0 && data.places.length > 1) {
    const second = data.places[1];
    const phone2 = second.internationalPhoneNumber || second.nationalPhoneNumber;
    if (phone2) {
      const normalized = normalizePhone(phone2);
      if (normalized) phones.push(normalized);
    }
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
