import { ALLOWED_METRICS } from "./constants.js";

export class TransitValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransitValidationError";
    this.statusCode = 400;
  }
}

const FILTERS = {
  ntdId: { field: "ntd_id", max: 12 },
  state: { field: "state", max: 3 },
  uza: { field: "uza_name", max: 140 },
  region: { field: "fta_region", max: 3 },
  mode: { field: "mode", max: 3 },
  modeGroup: { field: "_3_mode", max: 24 },
  tos: { field: "tos", max: 3 },
  status: { field: "mode_type_of_service_status", max: 16 },
};

const safeText = (value, max, label) => {
  const text = String(value || "").trim();
  if (!text || text.length > max || /[\u0000-\u001f]/.test(text)) {
    throw new TransitValidationError(`Invalid ${label} filter.`);
  }
  return text.replaceAll("'", "''");
};

const normalizeDate = (value, label) => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(text)) {
    throw new TransitValidationError(`${label} must use YYYY-MM-01.`);
  }
  return text;
};

export const parseTransitFilters = (query = {}) => {
  const filters = {};

  Object.entries(FILTERS).forEach(([key, definition]) => {
    if (query[key] !== undefined && query[key] !== "") {
      filters[key] = safeText(query[key], definition.max, key);
    }
  });

  filters.start = normalizeDate(query.start, "start") || "2002-01-01";
  filters.end = normalizeDate(query.end, "end");
  filters.metric = query.metric || "upt";

  if (!ALLOWED_METRICS.includes(filters.metric)) {
    throw new TransitValidationError("Unsupported transit metric.");
  }

  if (filters.end && filters.start > filters.end) {
    throw new TransitValidationError("The start month must be before the end month.");
  }

  return filters;
};

export const buildWhereClause = (filters = {}) => {
  const conditions = [];

  Object.entries(FILTERS).forEach(([key, definition]) => {
    if (filters[key]) conditions.push(`${definition.field}='${filters[key]}'`);
  });

  if (filters.start) conditions.push(`date >= '${filters.start}T00:00:00.000'`);
  if (filters.end) conditions.push(`date <= '${filters.end}T00:00:00.000'`);

  return conditions.join(" AND ");
};

export const parseComparisonIds = (value) => {
  const ids = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!ids.length || ids.length > 5 || ids.some((id) => !/^\d{4,6}$/.test(id))) {
    throw new TransitValidationError("Compare between one and five valid NTD IDs.");
  }

  return [...new Set(ids)];
};

