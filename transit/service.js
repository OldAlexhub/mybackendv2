import {
  MODE_LABELS,
  TRANSIT_CAVEATS,
  TRANSIT_DATASET_ID,
  TRANSIT_SOURCE_PAGE,
} from "./constants.js";
import { readTransitArtifact } from "./artifacts.js";
import {
  aggregateRows,
  makeOverviewFacts,
  normalizeMonthlyRow,
  summarizeSeries,
} from "./analytics.js";
import { buildWhereClause } from "./query.js";
import { getSocrataMetadata, querySocrata } from "./socrata.js";

const readManifest = () =>
  readTransitArtifact("manifest.json", {
    datasetId: TRANSIT_DATASET_ID,
    generatedAt: null,
    sourceUpdatedAt: null,
    dataThrough: null,
    status: "fallback-unavailable",
  });

const envelope = ({ data, filters = {}, release, provenance, warning = null }) => ({
  data,
  filters,
  release,
  provenance,
  warning,
  caveats: TRANSIT_CAVEATS,
});

const filterDates = (rows, filters) =>
  rows.filter(
    (row) =>
      (!filters.start || row.date >= filters.start) &&
      (!filters.end || row.date <= filters.end)
  );

const fallbackTimeseries = async (filters) => {
  let filename = "national-monthly.json";
  let selector = () => true;

  if (filters.uza || filters.region) {
    return null;
  } else if (filters.ntdId) {
    if (filters.state || filters.mode || filters.modeGroup || filters.tos || filters.status) return null;
    const agencies = await readTransitArtifact("agency-latest.json", []);
    const agency = agencies.find((item) => item.ntdId === filters.ntdId);
    if (!agency?.latestDataMonth) return null;
    return filterDates([
      normalizeMonthlyRow({ ...agency, date: agency.latestDataMonth }),
    ], filters);
  } else if (filters.state && (filters.mode || filters.modeGroup || filters.tos || filters.status)) {
    return null;
  } else if (filters.state) {
    filename = "geography-monthly.json";
    selector = (row) => row.state === filters.state;
  } else if (filters.tos || filters.status) {
    filename = "mode-service-monthly.json";
    selector = (row) =>
      (!filters.modeGroup || row.modeGroup === filters.modeGroup) &&
      (!filters.mode || row.mode === filters.mode) &&
      (!filters.tos || row.tos === filters.tos) &&
      (!filters.status || row.status === filters.status);
  } else if (filters.mode) {
    filename = "mode-detail-monthly.json";
    selector = (row) => row.mode === filters.mode;
  } else if (filters.modeGroup) {
    filename = "mode-monthly.json";
    selector = (row) => row.modeGroup === filters.modeGroup;
  }

  const artifact = await readTransitArtifact(filename, []);
  if (!Array.isArray(artifact) || !artifact.length) return null;
  const selected = artifact.filter(selector);
  let rows = selected.map(normalizeMonthlyRow);
  if (filename === "mode-service-monthly.json") {
    const byDate = new Map();
    selected.forEach((row) => {
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date).push(row);
    });
    rows = [...byDate.entries()].map(([date, items]) =>
      normalizeMonthlyRow({ date, ...aggregateRows(items) })
    );
  }
  return filterDates(rows, filters);
};

export const getTransitMeta = async () => {
  const manifest = await readManifest();
  try {
    const live = await getSocrataMetadata();
    return envelope({
      data: {
        ...live,
        datasetId: TRANSIT_DATASET_ID,
        sourceUrl: TRANSIT_SOURCE_PAGE,
        artifactGeneratedAt: manifest.generatedAt,
        artifactDataThrough: manifest.dataThrough,
        stale: Boolean(
          manifest.sourceUpdatedAt && live.sourceUpdatedAt !== manifest.sourceUpdatedAt
        ),
      },
      release: manifest,
      provenance: "live-metadata",
    });
  } catch (error) {
    return envelope({
      data: {
        ...manifest,
        datasetId: TRANSIT_DATASET_ID,
        sourceUrl: TRANSIT_SOURCE_PAGE,
        stale: true,
      },
      release: manifest,
      provenance: "static-artifact",
      warning: "DOT metadata is temporarily unavailable. Showing the last accepted release.",
    });
  }
};

export const getTransitFilters = async () => {
  const manifest = await readManifest();

  try {
    const [agencies, dimensions] = await Promise.all([
      querySocrata({
        select:
          "ntd_id, agency, state, fta_region, uza_name, reporter_type",
        groupBy:
          "ntd_id, agency, state, fta_region, uza_name, reporter_type",
        orderBy: "agency",
        limit: 10_000,
        cacheTtlMs: 24 * 60 * 60 * 1000,
      }),
      querySocrata({
        select: "mode, tos, _3_mode, mode_type_of_service_status",
        groupBy: "mode, tos, _3_mode, mode_type_of_service_status",
        orderBy: "_3_mode, mode, tos",
        limit: 5_000,
        cacheTtlMs: 24 * 60 * 60 * 1000,
      }),
    ]);

    return envelope({
      data: {
        agencies: agencies.map((row) => ({
          ntdId: row.ntd_id,
          agency: row.agency,
          state: row.state,
          ftaRegion: row.fta_region,
          uza: row.uza_name,
          reporterType: row.reporter_type,
        })),
        states: [...new Set(agencies.map((row) => row.state).filter(Boolean))].sort(),
        regions: [...new Set(agencies.map((row) => row.fta_region).filter(Boolean))].sort(
          (a, b) => Number(a) - Number(b)
        ),
        uzas: [...new Set(agencies.map((row) => row.uza_name).filter(Boolean))].sort(),
        modes: [...new Set(dimensions.map((row) => row.mode).filter(Boolean))]
          .sort()
          .map((code) => ({ code, label: MODE_LABELS[code] || code })),
        modeGroups: [...new Set(dimensions.map((row) => row._3_mode).filter(Boolean))].sort(),
        typesOfService: [...new Set(dimensions.map((row) => row.tos).filter(Boolean))].sort(),
        statuses: [
          ...new Set(dimensions.map((row) => row.mode_type_of_service_status).filter(Boolean)),
        ].sort(),
      },
      release: manifest,
      provenance: "live-query",
    });
  } catch (error) {
    const agencies = await readTransitArtifact("agency-latest.json", []);
    return envelope({
      data: {
        agencies,
        states: [...new Set(agencies.map((row) => row.state).filter(Boolean))].sort(),
        regions: [...new Set(agencies.map((row) => row.ftaRegion).filter(Boolean))].sort(),
        uzas: [],
        modes: Object.entries(MODE_LABELS).map(([code, label]) => ({ code, label })),
        modeGroups: ["Bus", "Ferry", "Rail", "Other"],
        typesOfService: ["DO", "PT", "TN", "TX"],
        statuses: ["Active", "Inactive"],
      },
      release: manifest,
      provenance: "static-artifact",
      warning: "Live filter options are unavailable; using the accepted snapshot.",
    });
  }
};

export const getTransitTimeseries = async (filters) => {
  const manifest = await readManifest();
  const where = buildWhereClause(filters);

  try {
    const rows = await querySocrata({
      select:
        "date, sum(upt) as upt, sum(vrm) as vrm, sum(vrh) as vrh, sum(voms) as voms",
      where,
      groupBy: "date",
      orderBy: "date",
      limit: 10_000,
    });

    return envelope({
      data: rows.map(normalizeMonthlyRow),
      filters,
      release: manifest,
      provenance: "live-query",
    });
  } catch (error) {
    const fallback = await fallbackTimeseries(filters);
    if (!fallback) throw error;

    return envelope({
      data: fallback,
      filters,
      release: manifest,
      provenance: "static-artifact",
      warning: "DOT is temporarily unavailable. Showing the last accepted snapshot.",
    });
  }
};

export const getTransitOverview = async (filters) => {
  const timeseries = await getTransitTimeseries(filters);
  const summary = summarizeSeries(timeseries.data);
  return {
    ...timeseries,
    data: {
      ...summary,
      facts: makeOverviewFacts(summary, timeseries.release),
    },
  };
};

export const getTransitComparison = async (ids, filters) => {
  const manifest = await readManifest();
  const withoutAgency = { ...filters };
  delete withoutAgency.ntdId;
  const agencyCondition = `ntd_id in(${ids.map((id) => `'${id}'`).join(",")})`;
  const baseWhere = buildWhereClause(withoutAgency);
  const where = baseWhere ? `${agencyCondition} AND ${baseWhere}` : agencyCondition;

  try {
    const rows = await querySocrata({
      select:
        "ntd_id, agency, date, sum(upt) as upt, sum(vrm) as vrm, sum(vrh) as vrh, sum(voms) as voms",
      where,
      groupBy: "ntd_id, agency, date",
      orderBy: "ntd_id, date",
      limit: 10_000,
    });
    const groups = new Map();
    rows.forEach((row) => {
      if (!groups.has(row.ntd_id)) {
        groups.set(row.ntd_id, { ntdId: row.ntd_id, agency: row.agency, series: [] });
      }
      groups.get(row.ntd_id).series.push(normalizeMonthlyRow(row));
    });

    return envelope({
      data: [...groups.values()].map((group) => ({
        ...group,
        summary: summarizeSeries(group.series),
      })),
      filters,
      release: manifest,
      provenance: "live-query",
    });
  } catch (error) {
    const agencies = await readTransitArtifact("agency-latest.json", []);
    const selected = agencies.filter((row) => ids.includes(row.ntdId));
    if (!selected.length) throw error;
    return envelope({
      data: selected.map((row) => ({
        ntdId: row.ntdId,
        agency: row.agency,
        series: [],
        summary: { latest: row, changes: {} },
      })),
      filters,
      release: manifest,
      provenance: "static-artifact",
      warning: "Live comparison history is unavailable; showing latest accepted values.",
    });
  }
};

export const getTransitSignals = async (filters = {}) => {
  const [manifest, artifact] = await Promise.all([
    readManifest(),
    readTransitArtifact("signals.json", { items: [] }),
  ]);
  const items = artifact.items || [];
  const filtered = filters.ntdId
    ? items.filter((item) => item.scopeId === filters.ntdId)
    : items.filter((item) => {
        if (item.scopeType === "agency") return false;
        if (filters.modeGroup) return item.scopeId === `mode:${filters.modeGroup}`;
        return item.scopeType === "national";
      });
  return envelope({
    data: { ...artifact, items: filtered.slice(0, 100) },
    filters,
    release: manifest,
    provenance: "static-artifact",
  });
};

export const getTransitForecast = async (filters = {}) => {
  const [manifest, artifact] = await Promise.all([
    readManifest(),
    readTransitArtifact("forecasts.json", { items: [] }),
  ]);
  const items = (artifact.items || []).filter((item) => {
    if (filters.ntdId && item.scopeId !== filters.ntdId) return false;
    if (filters.metric && item.metric !== filters.metric) return false;
    return true;
  });
  return envelope({
    data: { ...artifact, items: items.slice(0, 100) },
    filters,
    release: manifest,
    provenance: "static-artifact",
  });
};
