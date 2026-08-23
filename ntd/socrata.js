import { NTD_SOURCE } from "./config.js";

const REQUEST_TIMEOUT_MS = 18_000;
const MAX_ATTEMPTS = 2;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchJson = async (url, attempt = 1) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = { Accept: "application/json" };
    if (process.env.SOCRATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
    }

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`FTA source returned ${response.status}: ${body.slice(0, 180)}`);
    }
    return response.json();
  } catch (error) {
    if (attempt < MAX_ATTEMPTS && (error.name === "AbortError" || error instanceof TypeError)) {
      await wait(250 * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const queryDataset = async (datasetId, parameters = {}) => {
  const url = new URL(`/resource/${datasetId}.json`, NTD_SOURCE.portal);
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return fetchJson(url.toString());
};

export const getDatasetMetadata = async (datasetId) => {
  const url = new URL(`/api/views/${datasetId}`, NTD_SOURCE.portal);
  return fetchJson(url.toString());
};

