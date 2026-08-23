import { NTD_SOURCE } from "./config.js";
import https from "node:https";

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryDelay = (attempt, retryAfter) => {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 5_000);
  return Math.min(400 * 2 ** (attempt - 1), 3_200);
};

const isRetryable = (error) =>
  [408, 425, 429, 500, 502, 503, 504].includes(error.statusCode) ||
  ["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "ETIMEDOUT"].includes(error.code);

const requestJson = (url, { includeToken = true, redirectCount = 0 } = {}) =>
  new Promise((resolve, reject) => {
    const headers = {
      Accept: "application/json",
      "Accept-Encoding": "identity",
      "User-Agent": "NTD-Intelligence/1.0 (+https://www.mohamedgad.com/projects/ntd-intelligence)",
    };
    const appToken = String(process.env.SOCRATA_APP_TOKEN || "").trim();
    if (includeToken && appToken) headers["X-App-Token"] = appToken;

    const request = https.get(url, { headers }, (response) => {
      const statusCode = response.statusCode || 500;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirectCount >= 3) {
          const error = new Error("FTA source redirected too many times.");
          error.statusCode = statusCode;
          reject(error);
          return;
        }
        resolve(
          requestJson(new URL(response.headers.location, url).toString(), {
            includeToken,
            redirectCount: redirectCount + 1,
          }),
        );
        return;
      }

      const chunks = [];
      let receivedBytes = 0;
      response.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("FTA source response exceeded the safe size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (statusCode < 200 || statusCode >= 300) {
          const error = new Error(`FTA source returned ${statusCode}: ${body.slice(0, 180)}`);
          error.statusCode = statusCode;
          error.retryAfter = response.headers["retry-after"];
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          const error = new Error("FTA source returned malformed JSON.");
          error.statusCode = 502;
          reject(error);
        }
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      const error = new Error("FTA source request timed out.");
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.on("error", reject);
  });

const fetchJson = async (url, attempt = 1, includeToken = true) => {
  const hasToken = Boolean(String(process.env.SOCRATA_APP_TOKEN || "").trim());

  try {
    return await requestJson(url, { includeToken });
  } catch (error) {
    if (includeToken && hasToken && [401, 403].includes(error.statusCode)) {
      return fetchJson(url, 1, false);
    }
    if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
      await wait(retryDelay(attempt, error.retryAfter));
      return fetchJson(url, attempt + 1, includeToken);
    }
    throw error;
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

export const __testing = { isRetryable, retryDelay };
