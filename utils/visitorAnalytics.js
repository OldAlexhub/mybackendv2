import geoip from "geoip-lite";
import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";

const UNKNOWN_VALUE = "Unknown";
const VISIT_WINDOW_IN_HOURS = 12;
const BOT_PATTERN =
  /bot|spider|crawler|preview|slurp|bingpreview|headless|wget|curl|python-requests|node-fetch|axios/i;

const sanitizeText = (value, fallback = UNKNOWN_VALUE) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const normalizeIp = (value) => {
  const rawIp = Array.isArray(value) ? value[0] : value;
  const firstIp = `${rawIp || ""}`.split(",")[0].trim();

  if (!firstIp) {
    return UNKNOWN_VALUE;
  }

  if (firstIp === "::1") {
    return "127.0.0.1";
  }

  return firstIp.replace(/^::ffff:/, "");
};

const isPrivateIp = (ipAddress) => {
  if (!ipAddress || ipAddress === UNKNOWN_VALUE) {
    return true;
  }

  return (
    ipAddress === "127.0.0.1" ||
    ipAddress === "0.0.0.0" ||
    ipAddress.startsWith("10.") ||
    ipAddress.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress)
  );
};

export const extractVisitorMetadata = (req) => {
  const forwardedIp = req.headers["x-forwarded-for"];
  const ipAddress = normalizeIp(forwardedIp || req.ip);
  const userAgent = sanitizeText(req.headers["user-agent"]);
  const referrer = sanitizeText(req.headers.referer, "Direct");

  return {
    ipAddress,
    userAgent,
    referrer,
    isBot: BOT_PATTERN.test(userAgent),
  };
};

export const resolveVisitorLocation = (ipAddress) => {
  if (isPrivateIp(ipAddress)) {
    return {
      country: UNKNOWN_VALUE,
      region: UNKNOWN_VALUE,
      city: UNKNOWN_VALUE,
      timezone: UNKNOWN_VALUE,
      latitude: null,
      longitude: null,
    };
  }

  const geoRecord = geoip.lookup(ipAddress);

  if (!geoRecord) {
    return {
      country: UNKNOWN_VALUE,
      region: UNKNOWN_VALUE,
      city: UNKNOWN_VALUE,
      timezone: UNKNOWN_VALUE,
      latitude: null,
      longitude: null,
    };
  }

  return {
    country: sanitizeText(geoRecord.country),
    region: sanitizeText(geoRecord.region),
    city: sanitizeText(geoRecord.city),
    timezone: sanitizeText(geoRecord.timezone),
    latitude: Array.isArray(geoRecord.ll) ? geoRecord.ll[0] : null,
    longitude: Array.isArray(geoRecord.ll) ? geoRecord.ll[1] : null,
  };
};

export const shouldCountNewVisit = (lastVisitAt, now = new Date()) => {
  if (!lastVisitAt) {
    return true;
  }

  const elapsedMs = now.getTime() - new Date(lastVisitAt).getTime();
  return elapsedMs >= VISIT_WINDOW_IN_HOURS * 60 * 60 * 1000;
};

export const buildVisitorSummary = async () => {
  const [totalUniqueVisitors, totalVisitsAggregate, totalCountries] =
    await Promise.all([
      VisitorProfileModel.countDocuments(),
      VisitorProfileModel.aggregate([
        {
          $group: {
            _id: null,
            totalVisits: { $sum: "$visitCount" },
          },
        },
      ]),
      VisitorProfileModel.distinct("country", {
        country: { $nin: [null, "", UNKNOWN_VALUE] },
      }).then((countries) => countries.length),
    ]);

  return {
    totalUniqueVisitors,
    totalVisits: totalVisitsAggregate[0]?.totalVisits || 0,
    totalCountries,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const buildVisitorAnalytics = async () => {
  const dailyTrafficWindowStart = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  );
  const popularPagesWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const [
    summary,
    returningVisitors,
    activeVisitorsLast30Days,
    topCountries,
    topCities,
    topReferrers,
    recentVisitors,
    dailyTraffic,
    popularPages,
  ] =
    await Promise.all([
      buildVisitorSummary(),
      VisitorProfileModel.countDocuments({ visitCount: { $gt: 1 } }),
      VisitorProfileModel.countDocuments({
        lastSeenAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
      VisitorProfileModel.aggregate([
        {
          $match: {
            country: { $nin: [null, "", UNKNOWN_VALUE] },
          },
        },
        {
          $group: {
            _id: "$country",
            visitors: { $sum: 1 },
          },
        },
        { $sort: { visitors: -1, _id: 1 } },
        { $limit: 8 },
      ]),
      VisitorProfileModel.aggregate([
        {
          $match: {
            city: { $nin: [null, "", UNKNOWN_VALUE] },
          },
        },
        {
          $group: {
            _id: {
              city: "$city",
              region: "$region",
              country: "$country",
            },
            visitors: { $sum: 1 },
          },
        },
        { $sort: { visitors: -1, "_id.city": 1 } },
        { $limit: 8 },
      ]),
      VisitorProfileModel.aggregate([
        {
          $match: {
            referrer: { $nin: [null, "", "Direct"] },
          },
        },
        {
          $group: {
            _id: "$referrer",
            visitors: { $sum: 1 },
          },
        },
        { $sort: { visitors: -1, _id: 1 } },
        { $limit: 8 },
      ]),
      VisitorProfileModel.find()
        .sort({ lastSeenAt: -1 })
        .limit(50)
        .select(
          "ipAddress city region country timezone visitCount pageViewCount referrer firstPage lastPage firstSeenAt lastSeenAt userAgent"
        )
        .lean(),
      VisitorInteractionModel.aggregate([
        {
          $match: {
            eventType: "page_view",
            timestamp: { $gte: dailyTrafficWindowStart },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$timestamp",
                },
              },
              visitorId: "$sessionId",
            },
            pageViews: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            uniqueVisitors: { $sum: 1 },
            pageViews: { $sum: "$pageViews" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      VisitorInteractionModel.aggregate([
        {
          $match: {
            eventType: "page_view",
            timestamp: { $gte: popularPagesWindowStart },
          },
        },
        {
          $group: {
            _id: "$pageUrl",
            pageViews: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$sessionId" },
          },
        },
        {
          $project: {
            _id: 1,
            pageViews: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
          },
        },
        { $sort: { pageViews: -1, _id: 1 } },
        { $limit: 8 },
      ]),
    ]);

  return {
    summary: {
      ...summary,
      returningVisitors,
      activeVisitorsLast30Days,
    },
    topCountries: topCountries.map((item) => ({
      country: item._id,
      visitors: item.visitors,
    })),
    topCities: topCities.map((item) => ({
      city: item._id.city,
      region: item._id.region,
      country: item._id.country,
      visitors: item.visitors,
    })),
    topReferrers: topReferrers.map((item) => ({
      referrer: item._id,
      visitors: item.visitors,
    })),
    dailyTraffic: dailyTraffic.map((item) => ({
      date: item._id,
      uniqueVisitors: item.uniqueVisitors,
      pageViews: item.pageViews,
    })),
    popularPages: popularPages.map((item) => ({
      pageUrl: item._id,
      pageViews: item.pageViews,
      uniqueVisitors: item.uniqueVisitors,
    })),
    recentVisitors,
  };
};
