import geoip from "geoip-lite";
import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";

const UNKNOWN_VALUE = "Unknown";
const VISIT_WINDOW_IN_HOURS = 12;
const MAX_ENGAGEMENT_MS = 30 * 60 * 1000;
const MAX_TRACKED_NAMES = 12;
const MAX_NAME_LENGTH = 80;
const BOT_PATTERN =
  /bot|spider|crawler|preview|slurp|bingpreview|headless|wget|curl|python-requests|node-fetch|axios/i;

const sanitizeText = (value, fallback = UNKNOWN_VALUE) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const sanitizeBoolean = (value) => {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
};

const sanitizeNumber = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(normalizedValue)));
};

const sanitizeTextList = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => sanitizeText(value, ""))
    .filter(Boolean)
    .slice(0, MAX_TRACKED_NAMES)
    .map((value) => value.slice(0, MAX_NAME_LENGTH));
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

export const normalizeEngagementMs = (value) =>
  sanitizeNumber(value, 0, 0, MAX_ENGAGEMENT_MS);

export const normalizeOccurredAt = (value, fallback = new Date()) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return parsedDate;
};

export const normalizeClientSignals = (signals) => {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return null;
  }

  const cookieNames = sanitizeTextList(signals.cookieNames);
  const cookieCount = sanitizeNumber(
    signals.cookieCount,
    cookieNames.length,
    0,
    200
  );

  return {
    cookiesEnabled: sanitizeBoolean(signals.cookiesEnabled),
    cookieCount: Math.max(cookieCount, cookieNames.length),
    cookieNames,
    localStorageItemCount: sanitizeNumber(
      signals.localStorageItemCount,
      0,
      0,
      1000
    ),
    localStorageBytes: sanitizeNumber(signals.localStorageBytes, 0, 0, 5000000),
    sessionStorageItemCount: sanitizeNumber(
      signals.sessionStorageItemCount,
      0,
      0,
      1000
    ),
    sessionStorageBytes: sanitizeNumber(
      signals.sessionStorageBytes,
      0,
      0,
      5000000
    ),
    cacheStorageSupported: sanitizeBoolean(signals.cacheStorageSupported),
    cacheBucketCount: sanitizeNumber(signals.cacheBucketCount, 0, 0, 200),
    cacheEntryCount: sanitizeNumber(signals.cacheEntryCount, 0, 0, 10000),
    lastCapturedAt: new Date(),
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
  const [
    totalUniqueVisitors,
    totalVisitsAggregate,
    totalCountries,
    totalEngagementAggregate,
  ] =
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
      VisitorProfileModel.aggregate([
        {
          $group: {
            _id: null,
            totalEngagementMs: { $sum: "$totalEngagementMs" },
          },
        },
      ]),
    ]);

  const totalVisits = totalVisitsAggregate[0]?.totalVisits || 0;
  const totalEngagementMs = totalEngagementAggregate[0]?.totalEngagementMs || 0;

  return {
    totalUniqueVisitors,
    totalVisits,
    totalCountries,
    totalEngagementMs,
    averageEngagementMsPerVisitor: totalUniqueVisitors
      ? Math.round(totalEngagementMs / totalUniqueVisitors)
      : 0,
    averageEngagementMsPerVisit: totalVisits
      ? Math.round(totalEngagementMs / totalVisits)
      : 0,
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
    storageInsights,
    topCookieNames,
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
          "ipAddress city region country timezone visitCount pageViewCount totalEngagementMs referrer firstPage lastPage firstSeenAt lastSeenAt userAgent clientSignals"
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
      VisitorProfileModel.aggregate([
        {
          $group: {
            _id: null,
            trackedProfiles: {
              $sum: {
                $cond: [{ $ne: ["$clientSignals.lastCapturedAt", null] }, 1, 0],
              },
            },
            cookiesEnabledVisitors: {
              $sum: {
                $cond: [{ $eq: ["$clientSignals.cookiesEnabled", true] }, 1, 0],
              },
            },
            totalCookieCount: { $sum: { $ifNull: ["$clientSignals.cookieCount", 0] } },
            totalLocalStorageItems: {
              $sum: { $ifNull: ["$clientSignals.localStorageItemCount", 0] },
            },
            totalLocalStorageBytes: {
              $sum: { $ifNull: ["$clientSignals.localStorageBytes", 0] },
            },
            totalSessionStorageItems: {
              $sum: { $ifNull: ["$clientSignals.sessionStorageItemCount", 0] },
            },
            totalSessionStorageBytes: {
              $sum: { $ifNull: ["$clientSignals.sessionStorageBytes", 0] },
            },
            cacheStorageSupportedVisitors: {
              $sum: {
                $cond: [
                  { $eq: ["$clientSignals.cacheStorageSupported", true] },
                  1,
                  0,
                ],
              },
            },
            visitorsWithCacheEntries: {
              $sum: {
                $cond: [{ $gt: ["$clientSignals.cacheEntryCount", 0] }, 1, 0],
              },
            },
            totalCacheBuckets: {
              $sum: { $ifNull: ["$clientSignals.cacheBucketCount", 0] },
            },
            totalCacheEntries: {
              $sum: { $ifNull: ["$clientSignals.cacheEntryCount", 0] },
            },
          },
        },
      ]),
      VisitorProfileModel.aggregate([
        {
          $match: {
            "clientSignals.cookieNames.0": { $exists: true },
          },
        },
        { $unwind: "$clientSignals.cookieNames" },
        {
          $group: {
            _id: "$clientSignals.cookieNames",
            visitors: { $sum: 1 },
          },
        },
        { $sort: { visitors: -1, _id: 1 } },
        { $limit: 8 },
      ]),
    ]);

  const storageSummary = storageInsights[0] || {
    trackedProfiles: 0,
    cookiesEnabledVisitors: 0,
    totalCookieCount: 0,
    totalLocalStorageItems: 0,
    totalLocalStorageBytes: 0,
    totalSessionStorageItems: 0,
    totalSessionStorageBytes: 0,
    cacheStorageSupportedVisitors: 0,
    visitorsWithCacheEntries: 0,
    totalCacheBuckets: 0,
    totalCacheEntries: 0,
  };
  const trackedProfiles = storageSummary.trackedProfiles || 0;

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
    storageInsights: {
      trackedProfiles,
      coverageRate: summary.totalUniqueVisitors
        ? trackedProfiles / summary.totalUniqueVisitors
        : 0,
      cookiesEnabledVisitors: storageSummary.cookiesEnabledVisitors || 0,
      averageCookieCount: trackedProfiles
        ? Number(
            (
              (storageSummary.totalCookieCount || 0) /
              trackedProfiles
            ).toFixed(1)
          )
        : 0,
      averageLocalStorageItems: trackedProfiles
        ? Number(
            (
              (storageSummary.totalLocalStorageItems || 0) /
              trackedProfiles
            ).toFixed(1)
          )
        : 0,
      averageLocalStorageBytes: trackedProfiles
        ? Math.round(
            (storageSummary.totalLocalStorageBytes || 0) / trackedProfiles
          )
        : 0,
      averageSessionStorageItems: trackedProfiles
        ? Number(
            (
              (storageSummary.totalSessionStorageItems || 0) /
              trackedProfiles
            ).toFixed(1)
          )
        : 0,
      averageSessionStorageBytes: trackedProfiles
        ? Math.round(
            (storageSummary.totalSessionStorageBytes || 0) / trackedProfiles
          )
        : 0,
      cacheStorageSupportedVisitors:
        storageSummary.cacheStorageSupportedVisitors || 0,
      visitorsWithCacheEntries: storageSummary.visitorsWithCacheEntries || 0,
      totalCacheBuckets: storageSummary.totalCacheBuckets || 0,
      totalCacheEntries: storageSummary.totalCacheEntries || 0,
      topCookieNames: topCookieNames.map((item) => ({
        name: item._id,
        visitors: item.visitors,
      })),
    },
    recentVisitors,
  };
};
