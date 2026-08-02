import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateRows,
  makeOverviewFacts,
  summarizeSeries,
} from "../transit/analytics.js";
import {
  buildWhereClause,
  parseComparisonIds,
  parseTransitFilters,
  TransitValidationError,
} from "../transit/query.js";
import {
  answerTransitQuestion,
  resetCopilotLimitsForTests,
} from "../transit/copilot.js";
import { transitCache } from "../transit/cache.js";
import { querySocrata } from "../transit/socrata.js";

test("derived productivity metrics use aggregate numerators and denominators", () => {
  const result = aggregateRows([
    { upt: 100, vrh: 10, vrm: 50, voms: 2 },
    { upt: 900, vrh: 90, vrm: 450, voms: 8 },
  ]);

  assert.equal(result.upt, 1000);
  assert.equal(result.uptPerVrh, 10);
  assert.equal(result.uptPerVrm, 2);
  assert.equal(result.vrmPerVrh, 5);
});

test("series summaries calculate same-month and rolling changes", () => {
  const rows = [];
  for (let month = 1; month <= 24; month += 1) {
    const year = month <= 12 ? 2024 : 2025;
    const monthNumber = month <= 12 ? month : month - 12;
    rows.push({
      date: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
      upt: month <= 12 ? 100 : 110,
      vrm: 50,
      vrh: 10,
      voms: 2,
    });
  }

  const summary = summarizeSeries(rows);
  assert.equal(summary.latest.date, "2025-12-01");
  assert.equal(summary.changes.upt.yoy, 10);
  assert.equal(summary.changes.upt.rolling12, 10);
  assert.equal(makeOverviewFacts(summary, {}).length, 7);
});

test("SoQL filters are allowlisted, date-validated, and quote-escaped", () => {
  const filters = parseTransitFilters({
    state: "NY",
    uza: "King's County",
    start: "2024-01-01",
    metric: "uptPerVrh",
  });
  const where = buildWhereClause(filters);

  assert.match(where, /state='NY'/);
  assert.match(where, /uza_name='King''s County'/);
  assert.match(where, /date >= '2024-01-01T00:00:00.000'/);
  assert.throws(
    () => parseTransitFilters({ start: "2024-01-15" }),
    TransitValidationError
  );
});

test("comparison accepts no more than five numeric NTD IDs", () => {
  assert.deepEqual(parseComparisonIds("00001,10003"), ["00001", "10003"]);
  assert.throws(() => parseComparisonIds("1,2,3,4,5,6"), TransitValidationError);
  assert.throws(() => parseComparisonIds("00001,drop table"), TransitValidationError);
});

test("local data guide is deterministic and blocks causal claims", async () => {
  resetCopilotLimitsForTests();
  const facts = [
    {
      id: "latest-upt",
      metric: "upt",
      label: "Unlinked passenger trips",
      display: "692.4M",
      date: "2026-05-01",
      yoyPercent: 0.6,
    },
  ];

  const fallback = await answerTransitQuestion({
    question: "What is the latest ridership?",
    clientId: "test-browser",
    facts,
    release: { sourceUpdatedAt: "2026-07-09T13:56:46Z" },
  });
  assert.equal(fallback.mode, "deterministic-guide");
  assert.match(fallback.answer, /692\.4M/);

  const cause = await answerTransitQuestion({
    question: "Why did ridership change?",
    clientId: "test-browser",
    facts,
    release: {},
  });
  assert.equal(cause.mode, "causal-guardrail");
  assert.match(cause.answer, /cannot establish why/i);
});

test("DOT outage circuit serves subsequent fallbacks without another network wait", async () => {
  transitCache.clear();
  transitCache.set("socrata:outage", { message: "source unavailable" }, 60_000);
  await assert.rejects(
    querySocrata({ select: "count(*) as rows" }),
    (error) => error.statusCode === 503 && /source unavailable/.test(error.message)
  );
  transitCache.clear();
});
