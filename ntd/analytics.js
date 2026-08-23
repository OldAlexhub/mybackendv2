const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const safeDivide = (numerator, denominator) => {
  const a = toNumber(numerator);
  const b = toNumber(denominator);
  if (a === null || b === null || b === 0) return null;
  const value = a / b;
  return Number.isFinite(value) ? value : null;
};

export const percentageChange = (current, previous) => {
  const ratio = safeDivide(toNumber(current) - toNumber(previous), previous);
  return ratio === null ? null : ratio * 100;
};

export const median = (values) => {
  const valid = values.map(toNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
};

export const percentileRank = (values, selected) => {
  const value = toNumber(selected);
  const valid = values.map(toNumber).filter((entry) => entry !== null).sort((a, b) => a - b);
  if (value === null || valid.length < 3) return null;
  const lower = valid.filter((entry) => entry < value).length;
  const equal = valid.filter((entry) => entry === value).length;
  return Math.round(((lower + equal * 0.5) / valid.length) * 100);
};

const sumPresent = (rows, field) => {
  const values = rows.map((row) => toNumber(row[field])).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
};

const maxPresent = (rows, field) => {
  const values = rows.map((row) => toNumber(row[field])).filter((value) => value !== null);
  return values.length ? Math.max(...values) : null;
};

const createMetrics = ({ upt, vrh, vrm, expense, fareRevenue, passengerMiles, voms }) => ({
  upt,
  vrh,
  vrm,
  operatingExpense: expense,
  fareRevenue,
  passengerMiles,
  voms,
  costPerTrip: safeDivide(expense, upt),
  costPerRevenueHour: safeDivide(expense, vrh),
  costPerRevenueMile: safeDivide(expense, vrm),
  tripsPerRevenueHour: safeDivide(upt, vrh),
  tripsPerRevenueMile: safeDivide(upt, vrm),
  averageOperatingSpeed: safeDivide(vrm, vrh),
  fareRevenuePerTrip: safeDivide(fareRevenue, upt),
  fareboxRecovery: safeDivide(fareRevenue, expense) === null ? null : safeDivide(fareRevenue, expense) * 100,
});

export const aggregateAnnualRows = (rows, mode = "all") => {
  const relevant = mode === "all" ? rows : rows.filter((row) => row.mode === mode);
  const byYear = new Map();
  relevant.forEach((row) => {
    const year = Number(row.report_year);
    if (!Number.isFinite(year)) return;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(row);
  });

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, yearRows]) => ({
      year,
      ...createMetrics({
        upt: sumPresent(yearRows, "unlinked_passenger_trips"),
        vrh: sumPresent(yearRows, "vehicle_revenue_hours"),
        vrm: sumPresent(yearRows, "vehicle_revenue_miles"),
        expense: sumPresent(yearRows, "total_operating_expenses"),
        fareRevenue: sumPresent(yearRows, "fare_revenues_earned"),
        passengerMiles: sumPresent(yearRows, "passenger_miles"),
        voms: mode === "all" ? maxPresent(yearRows, "agency_voms") : sumPresent(yearRows, "mode_voms"),
      }),
    }));
};

const monthlyDate = (row) => {
  if (row.date || row.month_year) return new Date(row.date || row.month_year);
  const year = Number(row.year);
  const month = MONTHS[String(row.month || "").toLowerCase()];
  return Number.isFinite(year) && month !== undefined ? new Date(Date.UTC(year, month, 1)) : null;
};

export const normalizeMonthlyRows = (rows, treatment, mode = "all") => {
  const relevant = mode === "all" ? rows : rows.filter((row) => row.mode === mode);
  const byDate = new Map();

  relevant.forEach((row) => {
    const parsed = monthlyDate(row);
    if (!parsed || Number.isNaN(parsed.valueOf())) return;
    const key = parsed.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(row);
  });

  const field = (completeName, rawName) => (treatment === "complete" ? completeName : rawName);
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateRows]) => {
      const upt = sumPresent(dateRows, field("upt", "ridership"));
      const vrh = sumPresent(dateRows, field("vrh", "vehicle_revenue_hours"));
      const vrm = sumPresent(dateRows, field("vrm", "vehicle_revenue_miles"));
      return {
        date,
        upt,
        vrh,
        vrm,
        voms: sumPresent(dateRows, field("voms", "vehicles")),
        tripsPerRevenueHour: safeDivide(upt, vrh),
        tripsPerRevenueMile: safeDivide(upt, vrm),
        averageOperatingSpeed: safeDivide(vrm, vrh),
        treatment,
      };
    });
};

export const addMonthlyComparisons = (series) =>
  series.map((point, index) => {
    const previousMonth = series[index - 1];
    const previousYear = series[index - 12];
    const rollingRows = series.slice(Math.max(0, index - 11), index + 1);
    return {
      ...point,
      monthOverMonth: previousMonth ? percentageChange(point.upt, previousMonth.upt) : null,
      yearOverYear: previousYear ? percentageChange(point.upt, previousYear.upt) : null,
      rolling12Ridership:
        rollingRows.length === 12 && rollingRows.every((row) => row.upt !== null)
          ? rollingRows.reduce((sum, row) => sum + row.upt, 0)
          : null,
    };
  });

export const summarizeModes = (annualRows) => {
  const latestYear = Math.max(...annualRows.map((row) => Number(row.report_year)).filter(Number.isFinite));
  const byMode = new Map();
  annualRows
    .filter((row) => Number(row.report_year) === latestYear)
    .forEach((row) => {
      const key = row.mode;
      if (!byMode.has(key)) byMode.set(key, { code: key, name: row.mode_name || key, rows: [] });
      byMode.get(key).rows.push(row);
    });

  return [...byMode.values()]
    .map(({ code, name, rows }) => ({
      code,
      name,
      upt: sumPresent(rows, "unlinked_passenger_trips"),
      vrh: sumPresent(rows, "vehicle_revenue_hours"),
      vrm: sumPresent(rows, "vehicle_revenue_miles"),
      operatingExpense: sumPresent(rows, "total_operating_expenses"),
      fareRevenue: sumPresent(rows, "fare_revenues_earned"),
      voms: sumPresent(rows, "mode_voms"),
    }))
    .sort((a, b) => (b.upt || 0) - (a.upt || 0));
};

export const buildInsights = ({ annual, monthly }) => {
  const insights = [];
  const latestAnnual = annual.at(-1);
  const priorAnnual = annual.at(-2);
  const latestMonthly = monthly.at(-1);

  if (latestMonthly?.yearOverYear !== null && latestMonthly?.yearOverYear !== undefined) {
    const direction = latestMonthly.yearOverYear >= 0 ? "increased" : "decreased";
    insights.push({
      tone: latestMonthly.yearOverYear >= 0 ? "positive" : "watch",
      title: "Ridership direction",
      finding: `Monthly ridership ${direction} ${Math.abs(latestMonthly.yearOverYear).toFixed(1)}% compared with the same month one year earlier.`,
      meaning:
        latestMonthly.yearOverYear >= 0
          ? "Passenger activity is above the comparable month, indicating stronger utilization during the selected period."
          : "Passenger activity is below the comparable month and deserves examination alongside service levels and local conditions.",
    });
  }

  if (latestAnnual && priorAnnual) {
    const ridershipChange = percentageChange(latestAnnual.upt, priorAnnual.upt);
    const serviceChange = percentageChange(latestAnnual.vrh, priorAnnual.vrh);
    if (ridershipChange !== null && serviceChange !== null) {
      const spread = ridershipChange - serviceChange;
      insights.push({
        tone: spread >= 0 ? "positive" : "neutral",
        title: "Ridership and service",
        finding: `Annual ridership changed ${ridershipChange.toFixed(1)}% while vehicle revenue hours changed ${serviceChange.toFixed(1)}%.`,
        meaning:
          spread >= 0
            ? "Ridership moved faster than service hours, which indicates improved passenger productivity for the period."
            : "Service hours moved faster than ridership, which suggests productivity should be monitored as the service change matures.",
      });
    }

    const costChange = percentageChange(latestAnnual.operatingExpense, priorAnnual.operatingExpense);
    if (costChange !== null && ridershipChange !== null && costChange - ridershipChange > 3) {
      insights.push({
        tone: "watch",
        title: "Cost pressure",
        finding: `Operating expense changed ${costChange.toFixed(1)}%, compared with ${ridershipChange.toFixed(1)}% for ridership.`,
        meaning: "Costs rose faster than passenger activity. This does not establish a cause, but it warrants review of labor, fuel, purchased transportation, and service mix.",
      });
    }
  }

  return insights.slice(0, 4);
};

export const aggregateFunding = (rows) => {
  if (!rows.length) return null;
  const latestYear = Math.max(...rows.map((row) => Number(row.report_year)).filter(Number.isFinite));
  const row = rows.find((entry) => Number(entry.report_year) === latestYear) || rows[0];
  const categories = [
    { key: "directlyGenerated", label: "Directly generated", value: toNumber(row.sum_fares_and_other_directly) },
    { key: "agencyTaxes", label: "Agency taxes & fees", value: toNumber(row.sum_taxes_fees_levied_by_transit) },
    { key: "local", label: "Local", value: toNumber(row.sum_local) },
    { key: "state", label: "State", value: toNumber(row.sum_state_1) },
    { key: "federal", label: "Federal", value: toNumber(row.sum_federal) },
  ];
  const total = toNumber(row.sum_total) ?? categories.reduce((sum, item) => sum + (item.value || 0), 0);
  return {
    year: latestYear,
    total,
    categories: categories.map((item) => ({
      ...item,
      share: item.value === null || !total ? null : (item.value / total) * 100,
    })),
  };
};

export const aggregateFleet = (ageRows, typeRows) => {
  if (!ageRows.length && !typeRows.length) return null;
  const latestYear = Math.max(
    ...[...ageRows, ...typeRows].map((row) => Number(row.report_year)).filter(Number.isFinite)
  );
  const ages = ageRows.filter(
    (row) => Number(row.report_year) === latestYear && !/\(service\)/i.test(row.vehicle_type || "")
  );
  const type = typeRows.find((row) => Number(row.report_year) === latestYear);
  const ageBands = [
    { label: "0–5 years", fields: ["_0", "_1", "_2", "_3", "_4", "_5"] },
    { label: "6–10 years", fields: ["_6", "_7", "_8", "_9", "_10"] },
    { label: "11–15 years", fields: ["_11", "_12", "_13_15"] },
    { label: "16+ years", fields: ["_16_20", "_21_25", "_26_30", "_31_60", "_60"] },
  ].map(({ label, fields }) => ({
    label,
    vehicles: ages.reduce(
      (sum, row) => sum + fields.reduce((inner, field) => inner + (toNumber(row[field]) || 0), 0),
      0
    ),
  }));
  const weightedAgeNumerator = ages.reduce(
    (sum, row) => sum + (toNumber(row.average_age_of_fleet_in_years) || 0) * (toNumber(row.total_vehicles) || 0),
    0
  );
  const ageVehicleTotal = ages.reduce((sum, row) => sum + (toNumber(row.total_vehicles) || 0), 0);

  return {
    year: latestYear,
    totalRevenueVehicles: toNumber(type?.total_revenue_vehicles) ?? ageVehicleTotal,
    vehiclesAtOrBeyondUsefulLife: toNumber(type?.total_revenue_vehicles_ulb),
    vehiclesReportingUsefulLife: toNumber(type?.total_rptulb),
    averageAge: ageVehicleTotal ? weightedAgeNumerator / ageVehicleTotal : null,
    ageBands,
    types: ages
      .map((row) => ({ name: row.vehicle_type, vehicles: toNumber(row.total_vehicles), averageAge: toNumber(row.average_age_of_fleet_in_years) }))
      .filter((row) => row.vehicles !== null)
      .sort((a, b) => b.vehicles - a.vehicles),
  };
};

export const aggregateSafety = (rows) => {
  const normalized = normalizeMonthlyRows(rows, "raw");
  const byDate = new Map();
  rows.forEach((row) => {
    const date = monthlyDate(row);
    if (!date || Number.isNaN(date.valueOf())) return;
    const key = date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(row);
  });
  const series = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateRows]) => {
      const events = sumPresent(dateRows, "total_events");
      const injuries = sumPresent(dateRows, "total_injuries");
      const fatalities = sumPresent(dateRows, "total_fatalities");
      const vrm = normalized.find((point) => point.date === date)?.vrm ?? null;
      return {
        date,
        events,
        injuries,
        fatalities,
        vrm,
        eventsPer100kVrm: safeDivide(events, vrm) === null ? null : safeDivide(events, vrm) * 100000,
      };
    });
  const complete = series.filter((point) => point.events !== null);
  return { series: complete, latest: complete.at(-1) || null };
};

const normalizePeerRow = (row) => {
  const ridership = toNumber(row.sum_unlinked_passenger_trips);
  const vrh = toNumber(row.sum_vehicle_revenue_hours);
  const vrm = toNumber(row.sum_vehicle_revenue_miles);
  const expense = toNumber(row.sum_total_operating_expenses);
  const fareRevenue = toNumber(row.sum_fare_revenues_earned);
  return {
    id: row.ntd_id,
    name: row.max_agency,
    city: row.max_city,
    state: row.max_state,
    reporterType: row.max_reporter_type,
    year: Number(row.report_year),
    uzaName: row.max_uza_name,
    uzaPopulation: toNumber(row.max_primary_uza_population),
    ...createMetrics({
      upt: ridership,
      vrh,
      vrm,
      expense,
      fareRevenue,
      passengerMiles: toNumber(row.sum_passenger_miles),
      voms: toNumber(row.max_agency_voms),
    }),
  };
};

export const normalizeNationalRows = (rows) => rows.map(normalizePeerRow).filter((row) => row.id && row.upt !== null);

export const buildPeerBenchmark = (selected, nationalRows, limit = 5) => {
  if (!selected) return { peers: [], benchmarks: {}, populationSize: 0 };
  const sameReporter = nationalRows.filter(
    (row) => row.id !== selected.id && row.reporterType === selected.reporterType
  );
  const population = sameReporter.length >= 8 ? sameReporter : nationalRows.filter((row) => row.id !== selected.id);
  const dimensions = ["upt", "voms", "operatingExpense", "vrh"];
  const distance = (candidate) =>
    dimensions.reduce((score, key) => {
      const a = toNumber(selected[key]);
      const b = toNumber(candidate[key]);
      if (a === null || b === null || a <= 0 || b <= 0) return score + 1;
      return score + Math.abs(Math.log10(a) - Math.log10(b));
    }, 0);
  const peers = [...population].sort((a, b) => distance(a) - distance(b)).slice(0, limit);
  const peerMetrics = [
    "upt",
    "voms",
    "operatingExpense",
    "costPerTrip",
    "costPerRevenueHour",
    "tripsPerRevenueHour",
    "tripsPerRevenueMile",
    "fareboxRecovery",
  ];
  const benchmarks = Object.fromEntries(
    peerMetrics.map((key) => [
      key,
      {
        agency: selected[key],
        peerMedian: median(peers.map((row) => row[key])),
        peerMin: peers.length ? Math.min(...peers.map((row) => row[key]).filter((value) => value !== null)) : null,
        peerMax: peers.length ? Math.max(...peers.map((row) => row[key]).filter((value) => value !== null)) : null,
        percentile: percentileRank(population.map((row) => row[key]), selected[key]),
      },
    ])
  );
  return { peers, benchmarks, populationSize: population.length };
};
