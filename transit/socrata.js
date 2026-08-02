import {
  TRANSIT_DATASET_URL,
  TRANSIT_METADATA_URL,
} from "./constants.js";
import { transitCache } from "./cache.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let sourceUnavailableUntil = 0;

const assertSourceAvailable = () => {
  if (Date.now() < sourceUnavailableUntil) {
    const error = new Error("DOT API is in a temporary outage cooldown.");
    error.statusCode = 503;
    throw error;
  }
};

const fetchWithRetries = async (url, options = {}, retries = 2) => {
  assertSourceAvailable();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(process.env.SOCRATA_APP_TOKEN
            ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN }
            : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`DOT API returned ${response.status}.`);
        error.statusCode = response.status;
        throw error;
      }

      const payload = await response.json();
      sourceUnavailableUntil = 0;
      return payload;
    } catch (error) {
      lastError = error;
      const retryable =
        error.name === "AbortError" ||
        !error.statusCode ||
        error.statusCode === 429 ||
        error.statusCode >= 500;
      if (!retryable || attempt === retries) break;
      await wait(250 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  sourceUnavailableUntil = Date.now() + 60_000;
  throw lastError;
};

export const querySocrata = async ({
  select,
  where,
  groupBy,
  orderBy,
  limit = 50_000,
  offset = 0,
  cacheTtlMs,
}) => {
  const outage = transitCache.get("socrata:outage");
  if (outage) {
    const error = new Error(outage.message || "DOT API is temporarily unavailable.");
    error.statusCode = 503;
    throw error;
  }

  const url = new URL(TRANSIT_DATASET_URL);
  url.searchParams.set("$select", select);
  if (where) url.searchParams.set("$where", where);
  if (groupBy) url.searchParams.set("$group", groupBy);
  if (orderBy) url.searchParams.set("$order", orderBy);
  url.searchParams.set("$limit", String(Math.min(limit, 50_000)));
  if (offset) url.searchParams.set("$offset", String(offset));

  const key = `socrata:${url.toString()}`;
  const cached = transitCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const data = await fetchWithRetries(url);
    return transitCache.set(key, data, cacheTtlMs);
  } catch (error) {
    transitCache.set(
      "socrata:outage",
      { message: error.message, detectedAt: new Date().toISOString() },
      60 * 1000
    );
    throw error;
  }
};

export const getSocrataMetadata = async () => {
  const key = "socrata:metadata";
  const cached = transitCache.get(key);
  if (cached !== undefined) return cached;

  const [metadata, stats] = await Promise.all([
    fetchWithRetries(TRANSIT_METADATA_URL),
    querySocrata({
      select: "count(*) as row_count, max(date) as data_through",
      cacheTtlMs: 60 * 60 * 1000,
    }),
  ]);

  const result = {
    sourceUpdatedAt: metadata.rowsUpdatedAt
      ? new Date(metadata.rowsUpdatedAt * 1000).toISOString()
      : null,
    metadataUpdatedAt: metadata.metadataUpdatedAt
      ? new Date(metadata.metadataUpdatedAt * 1000).toISOString()
      : null,
    rowCount: Number(stats?.[0]?.row_count || 0),
    dataThrough: stats?.[0]?.data_through?.slice(0, 10) || null,
    columns: metadata.columns?.map((column) => column.fieldName) || [],
  };

  return transitCache.set(key, result, 60 * 60 * 1000);
};

export { fetchWithRetries };
