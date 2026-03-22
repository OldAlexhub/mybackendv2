import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";
import {
  buildVisitorSummary,
  extractVisitorMetadata,
  resolveVisitorLocation,
  shouldCountNewVisit,
} from "../utils/visitorAnalytics.js";

const TrackVisitor = async (req, res) => {
  try {
    const visitorId = `${req.body.visitorId || req.body.sessionId || ""}`.trim();
    const pageUrl = `${req.body.pageUrl || "/"}`.trim();

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
    const location = resolveVisitorLocation(ipAddress);
    const existingVisitor = await VisitorProfileModel.findOne({ visitorId });

    await VisitorInteractionModel.create({
      sessionId: visitorId,
      ipAddress,
      userAgent,
      referrer,
      eventType: "page_view",
      pageUrl,
      timestamp: now,
    });

    if (!existingVisitor) {
      await VisitorProfileModel.create({
        visitorId,
        ipAddress,
        userAgent,
        referrer,
        firstPage: pageUrl,
        lastPage: pageUrl,
        firstSeenAt: now,
        lastSeenAt: now,
        lastVisitAt: now,
        visitCount: 1,
        pageViewCount: 1,
        ...location,
      });

      return res.status(201).json({
        message: "Visitor tracked successfully.",
        isNewVisitor: true,
        summary: await buildVisitorSummary(),
      });
    }

    existingVisitor.ipAddress = ipAddress;
    existingVisitor.userAgent = userAgent;
    existingVisitor.referrer = referrer;
    existingVisitor.lastPage = pageUrl;
    existingVisitor.lastSeenAt = now;
    existingVisitor.country = location.country;
    existingVisitor.region = location.region;
    existingVisitor.city = location.city;
    existingVisitor.timezone = location.timezone;
    existingVisitor.latitude = location.latitude;
    existingVisitor.longitude = location.longitude;
    existingVisitor.pageViewCount += 1;

    if (shouldCountNewVisit(existingVisitor.lastVisitAt, now)) {
      existingVisitor.visitCount += 1;
      existingVisitor.lastVisitAt = now;
    }

    await existingVisitor.save();

    return res.status(200).json({
      message: "Visitor updated successfully.",
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
