import { Router } from "express";
import { compareAgencies, exploreNational, getAgencyReport, getNtdStatus, searchAgencies } from "../ntd/service.js";

const router = Router();

const asyncRoute = (handler) => async (req, res) => {
  try {
    const payload = await handler(req);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json(payload);
  } catch (error) {
    const status = error.statusCode || 503;
    console.error(`[NTD] ${req.method} ${req.originalUrl}: ${error.message}`);
    res.status(status).json({
      error: status === 404 ? error.message : "The official NTD source is temporarily unavailable.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

router.get("/api/ntd/status", asyncRoute(() => getNtdStatus()));
router.get("/api/ntd/agencies", asyncRoute((req) => searchAgencies(req.query.q, req.query.limit)));
router.get(
  "/api/ntd/agency/:id",
  asyncRoute((req) =>
    getAgencyReport(req.params.id, {
      period: req.query.period,
      treatment: req.query.treatment,
      mode: req.query.mode,
    })
  )
);
router.get("/api/ntd/explorer", asyncRoute((req) => exploreNational(req.query)));
router.get("/api/ntd/compare", asyncRoute((req) => compareAgencies(req.query.ids)));

export default router;
