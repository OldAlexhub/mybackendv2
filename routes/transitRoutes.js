import { Router } from "express";
import { CACHE_CONTROL } from "../transit/constants.js";
import { parseComparisonIds, parseTransitFilters } from "../transit/query.js";
import {
  getTransitComparison,
  getTransitFilters,
  getTransitForecast,
  getTransitMeta,
  getTransitOverview,
  getTransitSignals,
  getTransitTimeseries,
} from "../transit/service.js";
import { answerTransitQuestion } from "../transit/copilot.js";

const router = Router();

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

const send = (res, payload) => {
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.json(payload);
};

router.get("/meta", asyncRoute(async (_req, res) => send(res, await getTransitMeta())));
router.get("/filters", asyncRoute(async (_req, res) => send(res, await getTransitFilters())));

router.get(
  "/overview",
  asyncRoute(async (req, res) => {
    send(res, await getTransitOverview(parseTransitFilters(req.query)));
  })
);

router.get(
  "/timeseries",
  asyncRoute(async (req, res) => {
    send(res, await getTransitTimeseries(parseTransitFilters(req.query)));
  })
);

router.get(
  "/compare",
  asyncRoute(async (req, res) => {
    const ids = parseComparisonIds(req.query.ids);
    send(res, await getTransitComparison(ids, parseTransitFilters(req.query)));
  })
);

router.get(
  "/signals",
  asyncRoute(async (req, res) => {
    send(res, await getTransitSignals(parseTransitFilters(req.query)));
  })
);

router.get(
  "/forecast",
  asyncRoute(async (req, res) => {
    send(res, await getTransitForecast(parseTransitFilters(req.query)));
  })
);

router.get(
  "/download",
  asyncRoute(async (req, res) => {
    const result = await getTransitTimeseries(parseTransitFilters(req.query));
    const columns = [
      "date",
      "upt",
      "vrm",
      "vrh",
      "voms",
      "uptPerVrh",
      "uptPerVrm",
      "vrmPerVrh",
    ];
    const lines = [
      columns.join(","),
      ...result.data.map((row) =>
        columns.map((column) => JSON.stringify(row[column] ?? "")).join(",")
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=transit-signals.csv");
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.send(lines.join("\n"));
  })
);

router.post(
  "/copilot",
  asyncRoute(async (req, res) => {
    const question = String(req.body?.question || "").trim();
    const clientId = String(req.body?.clientId || req.ip || "anonymous").slice(0, 100);
    if (!question || question.length > 500) {
      return res.status(400).json({ error: "Ask a question between 1 and 500 characters." });
    }

    const filters = parseTransitFilters(req.body?.filters || {});
    const overview = await getTransitOverview(filters);
    const answer = await answerTransitQuestion({
      question,
      clientId,
      facts: overview.data.facts,
      release: overview.release,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: answer, release: overview.release, caveats: overview.caveats });
  })
);

router.use((error, _req, res, _next) => {
  const status = error.statusCode || 502;
  res.status(status).json({
    error: status === 400 ? error.message : "Transit data is temporarily unavailable.",
    detail: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

export default router;

