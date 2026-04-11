import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";
import {
  buildVisitorSummary,
  extractVisitorMetadata,
  normalizeClientSignals,
  normalizeEngagementMs,
  normalizeOccurredAt,
  resolveVisitorLocation,
  shouldCountNewVisit,
} from "../utils/visitorAnalytics.js";

const TrackVisitor = async (req, res) => {
  try {
    const visitorId = `${req.body.visitorId || req.body.sessionId || ""}`.trim();
    const pageUrl = `${req.body.pageUrl || "/"}`.trim();
    const requestedEventType = `${req.body.eventType || "page_view"}`
      .trim()
      .toLowerCase();
    const eventType =
      requestedEventType === "engagement" ? "engagement" : "page_view";
    const engagementMs = normalizeEngagementMs(req.body.engagementMs);
    const clientSignals = normalizeClientSignals(req.body.clientSignals);

    if (!visitorId || !pageUrl) {
      return res.status(400).json({
        message: "visitorId and pageUrl are required.",
      });
    }

    const { ipAddress, userAgent, referrer, isBot } =
      extractVisitorMetadata(req);

    if (isBot) {
      return res.status(202).json({
        message: "Bot traffic ignored.",
        ignored: true,
        summary: await buildVisitorSummary(),
      });
    }

    const now = new Date();
    const occurredAt = normalizeOccurredAt(req.body.occurredAt, now);
    const location = resolveVisitorLocation(ipAddress);
    const existingVisitor = await VisitorProfileModel.findOne({ visitorId });
    const isNewVisit = !existingVisitor
      ? true
      : shouldCountNewVisit(existingVisitor.lastVisitAt, occurredAt);

    if (eventType === "page_view") {
      await VisitorInteractionModel.create({
        sessionId: visitorId,
        ipAddress,
        userAgent,
        referrer,
        eventType: "page_view",
        pageUrl,
        timestamp: occurredAt,
      });
    } else if (engagementMs > 0) {
      await VisitorInteractionModel.create({
        sessionId: visitorId,
        ipAddress,
        userAgent,
        referrer,
        eventType: "engagement",
        pageUrl,
        timestamp: occurredAt,
        engagementMs,
      });
    }

    if (!existingVisitor) {
      await VisitorProfileModel.create({
        visitorId,
        ipAddress,
        userAgent,
        referrer,
        firstPage: pageUrl,
        lastPage: pageUrl,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        lastVisitAt: occurredAt,
        visitCount: 1,
        pageViewCount: eventType === "page_view" ? 1 : 0,
        totalEngagementMs: engagementMs,
        ...(clientSignals ? { clientSignals } : {}),
        ...location,
      });

      return res.status(201).json({
        message:
          eventType === "engagement"
            ? "Visitor engagement tracked successfully."
            : "Visitor tracked successfully.",
        isNewVisitor: true,
        summary: await buildVisitorSummary(),
      });
    }

    existingVisitor.ipAddress = ipAddress;
    existingVisitor.userAgent = userAgent;
    existingVisitor.referrer = referrer;
    existingVisitor.country = location.country;
    existingVisitor.region = location.region;
    existingVisitor.city = location.city;
    existingVisitor.timezone = location.timezone;
    existingVisitor.latitude = location.latitude;
    existingVisitor.longitude = location.longitude;

    const lastSeenAt = existingVisitor.lastSeenAt
      ? new Date(existingVisitor.lastSeenAt)
      : null;
    const shouldRefreshLatestState =
      !lastSeenAt || occurredAt.getTime() >= lastSeenAt.getTime();

    if (shouldRefreshLatestState) {
      existingVisitor.lastSeenAt = occurredAt;

      if (eventType === "page_view") {
        existingVisitor.lastPage = pageUrl;
      }
    }

    existingVisitor.totalEngagementMs =
      (existingVisitor.totalEngagementMs || 0) + engagementMs;

    if (clientSignals) {
      existingVisitor.clientSignals = clientSignals;
    }

    if (eventType === "page_view") {
      existingVisitor.pageViewCount = (existingVisitor.pageViewCount || 0) + 1;
    }

    if (isNewVisit) {
      existingVisitor.visitCount = (existingVisitor.visitCount || 0) + 1;
      existingVisitor.lastVisitAt = occurredAt;
    }

    await existingVisitor.save();

    return res.status(200).json({
      message:
        eventType === "engagement"
          ? "Visitor engagement updated successfully."
          : "Visitor updated successfully.",
      isNewVisitor: false,
      summary: await buildVisitorSummary(),
    });
  } catch (error) {
    console.error("TrackVisitor Error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default TrackVisitor;
