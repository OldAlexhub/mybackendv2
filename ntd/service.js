import { CACHE_TTL, NTD_DATASETS, NTD_SOURCE, PERIOD_YEARS } from "./config.js";
import { ntdCache } from "./cache.js";
import { getDatasetMetadata, queryDataset } from "./socrata.js";
import {
  addMonthlyComparisons,
  aggregateAnnualRows,
  aggregateFleet,
  aggregateFunding,
  aggregateSafety,
  buildInsights,
  buildPeerBenchmark,
  normalizeMonthlyRows,
  normalizeNationalRows,
  percentageChange,
  summarizeModes,
} from "./analytics.js";

const cleanId = (value) => {
  const id = String(value || "").trim();
  if (!/^\d{5}$/.test(id)) throw new Error("A valid five-digit NTD ID is required.");
  return id;
};

const escapeSoql = (value) => String(value).replaceAll("'", "''");

const aliasRules = [
  [/central florida regional transportation authority/i, ["lynx", "orlando lynx"]],
  [/metropolitan atlanta rapid transit authority/i, ["marta", "atlanta metro"]],
  [/washington metropolitan area transit authority/i, ["wmata", "washington metro"]],
  [/tri-county metropolitan transportation district/i, ["trimet", "portland transit"]],
  [/los angeles county metropolitan transportation authority/i, ["la metro", "lametro"]],
  [/dallas area rapid transit/i, ["dart", "dallas transit"]],
  [/massachusetts bay transportation authority/i, ["mbta", "boston t"]],
  [/new york city transit/i, ["mta", "nyc subway"]],
  [/southeastern pennsylvania transportation authority/i, ["septa", "philadelphia transit"]],
  [/chicago transit authority/i, ["cta", "chicago l"]],
];

const aliasesFor = (agency) =>
  aliasRules.flatMap(([pattern, aliases]) => (pattern.test(agency || "") ? aliases : []));

const normalizeSearch = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

const getLatestValues = async () => {
  const cache = await ntdCache.remember("ntd:status:maxima", CACHE_TTL.status, async () => {
    const [annual, adjusted, safety] = await Promise.all([
      queryDataset(NTD_DATASETS.annualMetrics.id, { "$select": "max(report_year) as latest" }),
      queryDataset(NTD_DATASETS.adjustedMonthly.id, { "$select": "max(date) as latest" }),
      queryDataset(NTD_DATASETS.rawMonthlySafety.id, { "$select": "max(month_year) as latest" }),
    ]);
    return {
      annualYear: Number(annual[0]?.latest),
      monthlyThrough: adjusted[0]?.latest?.slice(0, 10) || null,
      safetySourceThrough: safety[0]?.latest?.slice(0, 10) || null,
    };
  });
  return { ...cache.value, cache };
};

const metadataFor = async (dataset) => {
  try {
    const result = await ntdCache.remember(`ntd:metadata:${dataset.id}`, CACHE_TTL.metadata, () =>
      getDatasetMetadata(dataset.id)
    );
    const updated = result.value.rowsUpdatedAt || result.value.viewLastModified;
    return {
      id: dataset.id,
      name: dataset.name,
      url: `${NTD_SOURCE.portal}/d/${dataset.id}`,
      updatedAt: updated ? new Date(updated * 1000).toISOString() : null,
      cachedAt: result.cachedAt,
      stale: result.stale,
    };
  } catch (error) {
    return {
      id: dataset.id,
      name: dataset.name,
      url: `${NTD_SOURCE.portal}/d/${dataset.id}`,
      updatedAt: null,
      cachedAt: null,
      stale: true,
      statusMessage: "Publication metadata could not be refreshed.",
    };
  }
};

export const getNtdStatus = async () => {
  const latest = await getLatestValues();
  const sources = await Promise.all([
    metadataFor(NTD_DATASETS.adjustedMonthly),
    metadataFor(NTD_DATASETS.annualMetrics),
    metadataFor(NTD_DATASETS.rawMonthlySafety),
  ]);
  return {
    ...latest,
    checkedAt: latest.cache.cachedAt,
    stale: Boolean(latest.cache.stale || sources.some((source) => source.stale)),
    publisher: NTD_SOURCE.publisher,
    productPage: NTD_SOURCE.productPage,
    sources,
  };
};

const getAgencyDirectory = async () => {
  const latest = await getLatestValues();
  const result = await ntdCache.remember(
    `ntd:directory:${latest.annualYear}`,
    CACHE_TTL.agencyDirectory,
    () =>
      queryDataset(NTD_DATASETS.annualMetrics.id, {
        "$select": "distinct ntd_id,agency,city,state,reporter_type,uza_name,agency_voms",
        "$where": `report_year='${latest.annualYear}'`,
        "$limit": 5000,
      })
  );
  return result.value.map((row) => ({
    id: row.ntd_id,
    name: row.agency,
    city: row.city,
    state: row.state,
    reporterType: row.reporter_type,
    uzaName: row.uza_name,
    voms: Number(row.agency_voms) || null,
    aliases: aliasesFor(row.agency),
  }));
};

export const searchAgencies = async (query = "", requestedLimit = 10) => {
  const directory = await getAgencyDirectory();
  const limit = Math.min(Math.max(Number(requestedLimit) || 10, 1), 25);
  const normalizedQuery = normalizeSearch(query);
  const scored = directory
    .map((agency) => {
      const fields = [agency.name, agency.city, agency.state, agency.id, agency.uzaName, ...agency.aliases].map(normalizeSearch);
      let score = 0;
      if (!normalizedQuery) score = agency.voms || 0;
      else if (fields.some((field) => field === normalizedQuery)) score = 1000;
      else if (fields.some((field) => field.startsWith(normalizedQuery))) score = 700;
      else if (fields.some((field) => field.includes(normalizedQuery))) score = 400;
      return { agency, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (b.agency.voms || 0) - (a.agency.voms || 0))
    .slice(0, limit)
    .map(({ agency }) => agency);
  return { agencies: scored, observationCount: scored.length };
};

const getNationalRows = async (annualYear) => {
  const result = await ntdCache.remember(`ntd:national:${annualYear}`, CACHE_TTL.national, () =>
    queryDataset(NTD_DATASETS.annualAgencyMetrics.id, {
      "$where": `report_year='${annualYear}'`,
      "$limit": 5000,
    })
  );
  return normalizeNationalRows(result.value);
};

const startDateForPeriod = (latestDate, period) => {
  const years = PERIOD_YEARS[period] || PERIOD_YEARS["5y"];
  const date = latestDate ? new Date(latestDate) : new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
};

const loadAgencyRows = async ({ id, period, treatment, latestMonthly }) => {
  const selectedSince = startDateForPeriod(latestMonthly, period);
  const comparisonStart = new Date(selectedSince);
  comparisonStart.setUTCFullYear(comparisonStart.getUTCFullYear() - 1);
  const since = comparisonStart.toISOString().slice(0, 10);
  const monthlyDataset = treatment === "raw" ? NTD_DATASETS.rawMonthlySafety : NTD_DATASETS.adjustedMonthly;
  const monthlyIdField = treatment === "raw" ? "_5_digit_ntd_id" : "ntd_id";
  const monthlyDateField = treatment === "raw" ? "month_year" : "date";
  const safetySince = startDateForPeriod(latestMonthly, "5y");

  const [annual, monthly, funding, fleetAge, fleetTypes, safety] = await Promise.all([
    queryDataset(NTD_DATASETS.annualMetrics.id, {
      "$where": `ntd_id='${id}'`,
      "$order": "report_year asc",
      "$limit": 5000,
    }),
    queryDataset(monthlyDataset.id, {
      "$where": `${monthlyIdField}='${id}' and ${monthlyDateField}>='${since}T00:00:00.000'`,
      "$order": `${monthlyDateField} asc`,
      "$limit": 50000,
    }),
    queryDataset(NTD_DATASETS.funding.id, {
      "$where": `ntd_id='${id}'`,
      "$order": "report_year desc",
      "$limit": 10,
    }),
    queryDataset(NTD_DATASETS.fleetAge.id, {
      "$where": `ntd_id='${id}'`,
      "$order": "report_year desc",
      "$limit": 1000,
    }),
    queryDataset(NTD_DATASETS.fleetTypes.id, {
      "$where": `ntd_id='${id}'`,
      "$order": "report_year desc",
      "$limit": 10,
    }),
    queryDataset(NTD_DATASETS.rawMonthlySafety.id, {
      "$select": "_5_digit_ntd_id,agency,mode,mode_name,type_of_service,month_year,vehicle_revenue_miles,total_events,total_injuries,total_fatalities,non_major_physical_assaults_on_operators",
      "$where": `_5_digit_ntd_id='${id}' and month_year>='${safetySince}T00:00:00.000'`,
      "$order": "month_year asc",
      "$limit": 50000,
    }),
  ]);

  return { annual, monthly, funding, fleetAge, fleetTypes, safety, monthlyDataset, selectedSince };
};

const buildYtdComparison = (series) => {
  const latest = series.at(-1);
  if (!latest) return { current: null, previous: null, change: null };
  const latestDate = new Date(latest.date);
  const currentYear = latestDate.getUTCFullYear();
  const currentMonth = latestDate.getUTCMonth();
  const sum = (year) => {
    const values = series.filter((row) => {
      const date = new Date(row.date);
      return date.getUTCFullYear() === year && date.getUTCMonth() <= currentMonth && row.upt !== null;
    });
    return values.length ? values.reduce((total, row) => total + row.upt, 0) : null;
  };
  const current = sum(currentYear);
  const previous = sum(currentYear - 1);
  return { current, previous, change: percentageChange(current, previous) };
};

export const getAgencyReport = async (agencyId, options = {}) => {
  const id = cleanId(agencyId);
  const period = Object.hasOwn(PERIOD_YEARS, options.period) ? options.period : "5y";
  const treatment = options.treatment === "raw" ? "raw" : "complete";
  const mode = /^[A-Z]{2}$/.test(options.mode || "") ? options.mode : "all";
  const latest = await getLatestValues();
  const cacheKey = `ntd:agency:${id}:${period}:${treatment}`;
  const loaded = await ntdCache.remember(cacheKey, CACHE_TTL.agencyReport, () =>
    loadAgencyRows({
      id,
      period,
      treatment,
      latestMonthly: latest.monthlyThrough,
    })
  );
  const rows = loaded.value;
  const identityRow = [...rows.annual]
    .sort((a, b) => Number(b.report_year) - Number(a.report_year))[0];
  if (!identityRow && !rows.monthly.length) {
    const error = new Error("No official NTD observations were found for this agency.");
    error.statusCode = 404;
    throw error;
  }

  const annual = aggregateAnnualRows(rows.annual, mode);
  const comparisonMonthly = addMonthlyComparisons(normalizeMonthlyRows(rows.monthly, treatment, mode));
  const monthly = comparisonMonthly.filter((point) => point.date >= rows.selectedSince);
  const modes = summarizeModes(rows.annual);
  const funding = aggregateFunding(rows.funding);
  const fleet = aggregateFleet(rows.fleetAge, rows.fleetTypes);
  const safety = aggregateSafety(rows.safety.filter((row) => mode === "all" || row.mode === mode));
  const national = await getNationalRows(latest.annualYear);
  const selected = national.find((agency) => agency.id === id);
  const peers = buildPeerBenchmark(selected, national);
  const sources = await Promise.all([
    metadataFor(rows.monthlyDataset),
    metadataFor(NTD_DATASETS.annualMetrics),
    metadataFor(NTD_DATASETS.funding),
    metadataFor(NTD_DATASETS.fleetAge),
    metadataFor(NTD_DATASETS.rawMonthlySafety),
  ]);

  return {
    agency: {
      id,
      name: identityRow?.agency || rows.monthly[0]?.agency,
      commonName: aliasesFor(identityRow?.agency || "")[0] || null,
      city: identityRow?.city || null,
      state: identityRow?.state || rows.monthly[0]?.state || null,
      reporterType: identityRow?.reporter_type || rows.monthly[0]?.reporter_type || null,
      organizationType: identityRow?.organization_type || rows.monthly[0]?.organization_type || null,
      uzaName: identityRow?.uza_name || rows.monthly[0]?.uza_name || null,
      uzaPopulation: Number(identityRow?.primary_uza_population) || null,
      reportYear: Number(identityRow?.report_year) || latest.annualYear,
    },
    selection: { period, treatment, mode },
    modes,
    annual,
    monthly,
    funding,
    fleet,
    safety,
    peers,
    insights: buildInsights({ annual, monthly }),
    comparisons: { ytd: buildYtdComparison(comparisonMonthly) },
    freshness: {
      annualYear: latest.annualYear,
      monthlyThrough: monthly.at(-1)?.date || latest.monthlyThrough,
      safetyThrough: safety.latest?.date || null,
      checkedAt: loaded.cachedAt,
      stale: Boolean(loaded.stale || sources.some((source) => source.stale)),
      treatment,
    },
    sources,
    methodology: {
      reported: ["UPT", "VRH", "VRM", "VOMS", "operating expense", "fare revenue", "funding", "fleet", "safety events"],
      derived: ["percentage change", "cost per trip", "trips per revenue hour", "trips per revenue mile", "average operating speed", "farebox recovery", "peer percentile"],
      peerMethod: "Peers prioritize the same reporter type, then minimize distance across ridership, VOMS, operating expense, and revenue hours using log-scaled values.",
    },
  };
};

export const exploreNational = async (filters = {}) => {
  const latest = await getLatestValues();
  const rows = await getNationalRows(latest.annualYear);
  const state = String(filters.state || "").toUpperCase();
  const reporterType = String(filters.reporterType || "").toLowerCase();
  const sortKey = ["upt", "voms", "operatingExpense", "costPerTrip", "tripsPerRevenueHour"].includes(filters.metric)
    ? filters.metric
    : "upt";
  const filtered = rows
    .filter((row) => !state || row.state === state)
    .filter((row) => !reporterType || String(row.reporterType).toLowerCase() === reporterType)
    .filter((row) => row[sortKey] !== null)
    .sort((a, b) => b[sortKey] - a[sortKey]);
  return {
    year: latest.annualYear,
    metric: sortKey,
    totalAgencies: filtered.length,
    agencies: filtered.slice(0, Math.min(Math.max(Number(filters.limit) || 25, 1), 100)),
    states: [...new Set(rows.map((row) => row.state).filter(Boolean))].sort(),
    source: await metadataFor(NTD_DATASETS.annualAgencyMetrics),
  };
};

export const compareAgencies = async (idsValue = "") => {
  const ids = [...new Set(String(idsValue).split(",").map((value) => value.trim()).filter(Boolean))];
  if (!ids.length || ids.length > 6 || ids.some((id) => !/^\d{5}$/.test(id))) {
    const error = new Error("Choose between one and six valid five-digit NTD IDs.");
    error.statusCode = 400;
    throw error;
  }
  const latest = await getLatestValues();
  const national = await getNationalRows(latest.annualYear);
  return {
    year: latest.annualYear,
    agencies: ids.map((id) => national.find((agency) => agency.id === id)).filter(Boolean),
    source: await metadataFor(NTD_DATASETS.annualAgencyMetrics),
  };
};

export const __testing = { normalizeSearch, aliasesFor, startDateForPeriod, escapeSoql };
