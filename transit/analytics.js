import {
  ALLOWED_METRICS,
  BASE_METRICS,
  METRIC_LABELS,
} from "./constants.js";

export const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const safeRatio = (numerator, denominator) => {
  const a = toFiniteNumber(numerator);
  const b = toFiniteNumber(denominator);
  if (a === null || b === null || b <= 0) return null;
  return a / b;
};

export const normalizeMonthlyRow = (row) => {
  const normalized = {
    date: row.date?.slice(0, 10) || row.date,
  };

  BASE_METRICS.forEach((metric) => {
    normalized[metric] = toFiniteNumber(row[metric]);
  });

  normalized.uptPerVrh = safeRatio(normalized.upt, normalized.vrh);
  normalized.uptPerVrm = safeRatio(normalized.upt, normalized.vrm);
  normalized.vrmPerVrh = safeRatio(normalized.vrm, normalized.vrh);

  if (row.mode_group || row.modeGroup || row._3_mode) {
    normalized.modeGroup = row.mode_group || row.modeGroup || row._3_mode;
  }
  if (row.state) normalized.state = row.state;
  if (row.ntd_id || row.ntdId) normalized.ntdId = row.ntd_id || row.ntdId;
  if (row.agency) normalized.agency = row.agency;

  return normalized;
};

const sumMetric = (rows, metric) =>
  rows.reduce((total, row) => total + (toFiniteNumber(row[metric]) || 0), 0);

export const metricValue = (row, metric) => {
  if (!ALLOWED_METRICS.includes(metric)) return null;
  if (BASE_METRICS.includes(metric)) return toFiniteNumber(row?.[metric]);
  if (metric === "uptPerVrh") return safeRatio(row?.upt, row?.vrh);
  if (metric === "uptPerVrm") return safeRatio(row?.upt, row?.vrm);
  if (metric === "vrmPerVrh") return safeRatio(row?.vrm, row?.vrh);
  return null;
};

export const aggregateRows = (rows) => {
  const aggregate = Object.fromEntries(
    BASE_METRICS.map((metric) => [metric, sumMetric(rows, metric)])
  );
  aggregate.uptPerVrh = safeRatio(aggregate.upt, aggregate.vrh);
  aggregate.uptPerVrm = safeRatio(aggregate.upt, aggregate.vrm);
  aggregate.vrmPerVrh = safeRatio(aggregate.vrm, aggregate.vrh);
  return aggregate;
};

const pctChange = (current, previous) => {
  const a = toFiniteNumber(current);
  const b = toFiniteNumber(previous);
  if (a === null || b === null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
};

export const summarizeSeries = (series) => {
  if (!Array.isArray(series) || !series.length) {
    return { latest: null, priorYear: null, rolling12: null, changes: {} };
  }

  const sorted = [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = sorted.at(-1);
  const latestDate = new Date(`${latest.date.slice(0, 10)}T00:00:00Z`);
  const priorDate = new Date(latestDate);
  priorDate.setUTCFullYear(priorDate.getUTCFullYear() - 1);
  const priorKey = priorDate.toISOString().slice(0, 10);
  const priorYear = sorted.find((row) => row.date.slice(0, 10) === priorKey) || null;
  const last12 = sorted.slice(-12);
  const preceding12 = sorted.slice(-24, -12);
  const rolling12 = aggregateRows(last12);
  const previousRolling12 = aggregateRows(preceding12);

  const changes = {};
  ALLOWED_METRICS.forEach((metric) => {
    changes[metric] = {
      yoy: pctChange(metricValue(latest, metric), metricValue(priorYear, metric)),
      rolling12: preceding12.length === 12
        ? pctChange(metricValue(rolling12, metric), metricValue(previousRolling12, metric))
        : null,
    };
  });

  return { latest, priorYear, rolling12, previousRolling12, changes };
};

export const formatMetricValue = (value, metric) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return "Not available";
  if (!BASE_METRICS.includes(metric)) {
    return numeric.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (Math.abs(numeric) >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const makeOverviewFacts = (summary, release) => {
  if (!summary?.latest) return [];

  return ALLOWED_METRICS.map((metric) => ({
    id: `latest-${metric}`,
    metric,
    label: METRIC_LABELS[metric],
    value: metricValue(summary.latest, metric),
    display: formatMetricValue(metricValue(summary.latest, metric), metric),
    yoyPercent: summary.changes?.[metric]?.yoy ?? null,
    rolling12Percent: summary.changes?.[metric]?.rolling12 ?? null,
    date: summary.latest.date,
    release: release?.sourceUpdatedAt || release?.generatedAt || null,
  }));
};

