import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAnnualRows,
  aggregateFleet,
  buildInsights,
  buildPeerBenchmark,
  normalizeMonthlyRows,
  percentageChange,
  safeDivide,
} from "../ntd/analytics.js";

test("calculation helpers protect zero, null, and invalid denominators", () => {
  assert.equal(safeDivide(10, 0), null);
  assert.equal(safeDivide(null, 4), null);
  assert.equal(safeDivide("bad", 4), null);
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(10, 0), null);
});

test("annual aggregation preserves missing values and calculates agency ratios from totals", () => {
  const rows = [
    { report_year: "2024", mode: "MB", unlinked_passenger_trips: "100", vehicle_revenue_hours: "10", vehicle_revenue_miles: "120", total_operating_expenses: "500", fare_revenues_earned: "50", agency_voms: "12", mode_voms: "8" },
    { report_year: "2024", mode: "DR", unlinked_passenger_trips: "20", vehicle_revenue_hours: "5", vehicle_revenue_miles: "40", total_operating_expenses: "300", fare_revenues_earned: "10", agency_voms: "12", mode_voms: "4" },
    { report_year: "2023", mode: "MB", unlinked_passenger_trips: null, vehicle_revenue_hours: null, vehicle_revenue_miles: null, total_operating_expenses: null, fare_revenues_earned: null, agency_voms: "10", mode_voms: "10" },
  ];
  const annual = aggregateAnnualRows(rows);
  assert.equal(annual[0].upt, null);
  assert.equal(annual[1].upt, 120);
  assert.equal(annual[1].costPerTrip, 800 / 120);
  assert.equal(annual[1].tripsPerRevenueHour, 8);
  assert.equal(annual[1].voms, 12);
});

test("monthly normalization never turns an entirely missing metric into zero", () => {
  const series = normalizeMonthlyRows([
    { date: "2026-01-01T00:00:00.000", mode: "MB", upt: null, vrh: null, vrm: null, voms: null },
  ], "complete");
  assert.equal(series[0].upt, null);
  assert.equal(series[0].tripsPerRevenueHour, null);
});

test("fleet age bands sum official age fields and keep useful-life values distinct", () => {
  const fleet = aggregateFleet([
    { report_year: "2024", vehicle_type: "Bus", _0: "2", _5: "3", _6: "4", _10: "1", _11: "2", _13_15: "3", _16_20: "1", total_vehicles: "16", average_age_of_fleet_in_years: "7" },
  ], [{ report_year: "2024", total_revenue_vehicles: "16", total_rptulb: "12", total_revenue_vehicles_ulb: "4" }]);
  assert.deepEqual(fleet.ageBands.map((band) => band.vehicles), [5, 5, 5, 1]);
  assert.equal(fleet.vehiclesAtOrBeyondUsefulLife, 4);
  assert.equal(fleet.averageAge, 7);
});

test("insights describe association and do not make causal claims", () => {
  const insights = buildInsights({
    annual: [
      { year: 2023, upt: 100, vrh: 10, operatingExpense: 1000 },
      { year: 2024, upt: 110, vrh: 10.2, operatingExpense: 1200 },
    ],
    monthly: [{ date: "2026-01-01", upt: 10, yearOverYear: 8 }],
  });
  const text = JSON.stringify(insights).toLowerCase();
  assert.equal(text.includes("caused"), false);
  assert.equal(text.includes("indicat"), true);
});

test("peer matching prioritizes same reporter type and produces medians and percentiles", () => {
  const selected = { id: "1", reporterType: "Full", upt: 1000, voms: 20, operatingExpense: 10000, vrh: 100, costPerTrip: 10, costPerRevenueHour: 100, tripsPerRevenueHour: 10, tripsPerRevenueMile: 1, fareboxRecovery: 20 };
  const national = [
    selected,
    ...Array.from({ length: 10 }, (_, index) => ({ id: String(index + 2), reporterType: "Full", upt: 800 + index * 50, voms: 18 + index, operatingExpense: 9000 + index * 500, vrh: 90 + index * 3, costPerTrip: 9 + index, costPerRevenueHour: 90 + index, tripsPerRevenueHour: 8 + index / 2, tripsPerRevenueMile: 0.8 + index / 10, fareboxRecovery: 15 + index })),
    { id: "99", reporterType: "Reduced", upt: 1001, voms: 20, operatingExpense: 10001, vrh: 101 },
  ];
  const result = buildPeerBenchmark(selected, national);
  assert.equal(result.peers.length, 5);
  assert.ok(result.peers.every((peer) => peer.reporterType === "Full"));
  assert.equal(typeof result.benchmarks.upt.peerMedian, "number");
  assert.equal(typeof result.benchmarks.upt.percentile, "number");
});

