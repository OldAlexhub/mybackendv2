import geoip from "geoip-lite";
import { isIP } from "node:net";
import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";

const UNKNOWN_VALUE = "Unknown";
const VISIT_WINDOW_IN_HOURS = 12;
const MAX_ENGAGEMENT_MS = 30 * 60 * 1000;
const MAX_TRACKED_NAMES = 12;
const MAX_NAME_LENGTH = 80;
const RECENT_VISITOR_LIMIT = 50;
const BOT_PATTERN =
  /bot|spider|crawler|preview|slurp|bingpreview|headless|wget|curl|python-requests|node-fetch|axios/i;
const VISITOR_PROFILE_FIELDS =
  "visitorId ipAddress city region country timezone locationSource locationUpdatedAt visitCount pageViewCount totalEngagementMs referrer firstAcquisition latestAcquisition device firstPage lastPage firstSeenAt lastSeenAt userAgent clientSignals";

const LOCATION_HEADER_NAMES = {
  city: ["cf-ipcity", "x-vercel-ip-city", "cloudfront-viewer-city", "x-appengine-city"],
  region: [
    "cf-region-code",
    "cf-region",
    "x-vercel-ip-country-region",
    "cloudfront-viewer-country-region",
    "x-appengine-region",
  ],
  country: [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
    "x-appengine-country",
  ],
  timezone: [
    "cf-timezone",
    "x-vercel-ip-timezone",
    "cloudfront-viewer-time-zone",
  ],
  latitude: [
    "cf-iplatitude",
    "x-vercel-ip-latitude",
    "cloudfront-viewer-latitude",
  ],
  longitude: [
    "cf-iplongitude",
    "x-vercel-ip-longitude",
    "cloudfront-viewer-longitude",
  ],
};

const CLIENT_IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "true-client-ip",
  "cloudfront-viewer-address",
  "x-nf-client-connection-ip",
  "fly-client-ip",
  "x-real-ip",
  "x-forwarded-for",
];

const sanitizeText = (value, fallback = UNKNOWN_VALUE) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const isKnownValue = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !["", "unknown", "null", "undefined", "n/a", "-", "xx"].includes(
    normalizedValue
  );
};

const decodeHeaderValue = (value) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const sanitizedValue = sanitizeText(`${rawValue || ""}`, "");

  if (!sanitizedValue) {
    return "";
  }

  try {
    return decodeURIComponent(sanitizedValue.replace(/\+/g, "%20")).trim();
  } catch (error) {
    return sanitizedValue;
  }
};

const getFirstHeaderValue = (headers = {}, names = []) => {
  for (const name of names) {
    const value = decodeHeaderValue(headers[name]);

    if (isKnownValue(value)) {
      return value;
    }
  }

  return "";
};

const getHeaderCoordinate = (headers, names, min, max) => {
  const headerValue = getFirstHeaderValue(headers, names);

  if (!headerValue) {
    return null;
  }

  const value = Number(headerValue);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
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

const sanitizeAnalyticsText = (value, maxLength = 500, fallback = "") =>
  sanitizeText(value, fallback).slice(0, maxLength);

const getHostname = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch (error) {
    return "";
  }
};

export const normalizeAcquisition = (value, fallbackReferrer = "") => {
  const rawAcquisition =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const referrer = sanitizeAnalyticsText(
    rawAcquisition.referrer,
    1000,
    isKnownValue(fallbackReferrer) ? fallbackReferrer : ""
  );
  const referrerHost = sanitizeAnalyticsText(
    rawAcquisition.referrerHost,
    255,
    getHostname(referrer)
  );
  const source = sanitizeAnalyticsText(
    rawAcquisition.source,
    120,
    referrerHost || "Direct"
  );
  const medium = sanitizeAnalyticsText(
    rawAcquisition.medium,
    80,
    referrerHost ? "referral" : "none"
  );
  const capturedAt = new Date(rawAcquisition.capturedAt || Date.now());

  return {
    source,
    medium,
    channel: sanitizeAnalyticsText(
      rawAcquisition.channel,
      80,
      referrerHost ? "Referral" : "Direct"
    ),
    campaign: sanitizeAnalyticsText(rawAcquisition.campaign, 160),
    term: sanitizeAnalyticsText(rawAcquisition.term, 160),
    content: sanitizeAnalyticsText(rawAcquisition.content, 160),
    referrer,
    referrerHost,
    landingPage: sanitizeAnalyticsText(rawAcquisition.landingPage, 1000, "/"),
    clickProvider: sanitizeAnalyticsText(rawAcquisition.clickProvider, 80),
    redirectCount: sanitizeNumber(rawAcquisition.redirectCount, 0, 0, 20),
    capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
  };
};

export const parseUserAgent = (value) => {
  const userAgent = sanitizeText(value, "");
  const type = /ipad|tablet|kindle|silk/i.test(userAgent)
    ? "Tablet"
    : /mobile|iphone|ipod|android/i.test(userAgent)
      ? "Mobile"
      : "Desktop";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /opr\//i.test(userAgent)
      ? "Opera"
      : /samsungbrowser/i.test(userAgent)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(userAgent)
          ? "Firefox"
          : /chrome|crios/i.test(userAgent)
            ? "Chrome"
            : /safari/i.test(userAgent)
              ? "Safari"
              : "Other";
  const operatingSystem = /windows/i.test(userAgent)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(userAgent)
      ? "iOS"
      : /android/i.test(userAgent)
        ? "Android"
        : /mac os|macintosh/i.test(userAgent)
          ? "macOS"
          : /cros/i.test(userAgent)
            ? "ChromeOS"
            : /linux/i.test(userAgent)
              ? "Linux"
              : "Other";

  return { type, browser, operatingSystem };
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
  let firstIp = `${rawIp || ""}`.split(",")[0].trim().replace(/^"|"$/g, "");

  if (!firstIp) {
    return UNKNOWN_VALUE;
  }

  const bracketedIpv6Match = firstIp.match(/^\[([^\]]+)\](?::\d+)?$/);

  if (bracketedIpv6Match) {
    firstIp = bracketedIpv6Match[1];
  } else {
    firstIp = firstIp.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1");
  }

  if (firstIp === "::1") {
    return "127.0.0.1";
  }

  firstIp = firstIp.replace(/^::ffff:/i, "").split("%")[0];
  return isIP(firstIp) ? firstIp : UNKNOWN_VALUE;
};

const isPrivateIp = (ipAddress) => {
  if (!ipAddress || ipAddress === UNKNOWN_VALUE) {
    return true;
  }

  return (
    ipAddress === "127.0.0.1" ||
    ipAddress === "0.0.0.0" ||
    ipAddress === "::" ||
    ipAddress === "::1" ||
    ipAddress.startsWith("10.") ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("169.254.") ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ipAddress) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress) ||
    /^f[cd][0-9a-f]{2}:/i.test(ipAddress) ||
    /^fe[89ab][0-9a-f]:/i.test(ipAddress)
  );
};

export const isPublicIp = (ipAddress) =>
  isIP(ipAddress) > 0 && !isPrivateIp(ipAddress);

export const extractVisitorMetadata = (req) => {
  const forwardedIp = CLIENT_IP_HEADER_NAMES.map(
    (name) => req.headers[name]
  ).find(Boolean);
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

export const resolveVisitorLocation = (ipAddress, headers = {}) => {
  const edgeLocation = {
    city: getFirstHeaderValue(headers, LOCATION_HEADER_NAMES.city),
    region: getFirstHeaderValue(headers, LOCATION_HEADER_NAMES.region),
    country: getFirstHeaderValue(headers, LOCATION_HEADER_NAMES.country).toUpperCase(),
    timezone: getFirstHeaderValue(headers, LOCATION_HEADER_NAMES.timezone),
    latitude: getHeaderCoordinate(
      headers,
      LOCATION_HEADER_NAMES.latitude,
      -90,
      90
    ),
    longitude: getHeaderCoordinate(
      headers,
      LOCATION_HEADER_NAMES.longitude,
      -180,
      180
    ),
  };
  const geoRecord = isPublicIp(ipAddress) ? geoip.lookup(ipAddress) : null;
  const geoLocation = {
    country: sanitizeText(geoRecord?.country, ""),
    region: sanitizeText(geoRecord?.region, ""),
    city: sanitizeText(geoRecord?.city, ""),
    timezone: sanitizeText(geoRecord?.timezone, ""),
    latitude: Array.isArray(geoRecord?.ll) ? geoRecord.ll[0] : null,
    longitude: Array.isArray(geoRecord?.ll) ? geoRecord.ll[1] : null,
  };
  const edgeResolved = Object.values(edgeLocation).some(
    (value) => value !== "" && value !== null
  );
  const geoResolved = Object.values(geoLocation).some(
    (value) => value !== "" && value !== null
  );
  const preferKnownText = (edgeValue, geoValue) =>
    sanitizeText(isKnownValue(edgeValue) ? edgeValue : geoValue);
  const preferredCountry = preferKnownText(
    edgeLocation.country,
    geoLocation.country
  ).toUpperCase();
  const country = /^[A-Z]{2}$/.test(preferredCountry)
    ? preferredCountry
    : UNKNOWN_VALUE;

  return {
    country,
    region: preferKnownText(edgeLocation.region, geoLocation.region),
    city: preferKnownText(edgeLocation.city, geoLocation.city),
    timezone: preferKnownText(edgeLocation.timezone, geoLocation.timezone),
    latitude: edgeLocation.latitude ?? geoLocation.latitude,
    longitude: edgeLocation.longitude ?? geoLocation.longitude,
    locationSource:
      edgeResolved && geoResolved
        ? "edge+geoip"
        : edgeResolved
          ? "edge"
          : geoResolved
            ? "geoip"
            : "unavailable",
    locationUpdatedAt: edgeResolved || geoResolved ? new Date() : null,
  };
};

export const buildVisitorLocationUpdate = (currentLocation, nextLocation) => {
  const update = {};

  ["country", "region", "city", "timezone"].forEach((field) => {
    if (isKnownValue(nextLocation?.[field])) {
      update[field] = nextLocation[field];
    }
  });

  ["latitude", "longitude"].forEach((field) => {
    if (Number.isFinite(nextLocation?.[field])) {
      update[field] = nextLocation[field];
    }
  });

  if (Object.keys(update).length) {
    update.locationSource = isKnownValue(nextLocation?.locationSource)
      ? nextLocation.locationSource
      : currentLocation?.locationSource || "unavailable";
    update.locationUpdatedAt = nextLocation?.locationUpdatedAt || new Date();
  }

  return update;
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
  const [profileSummaryAggregate, totalCountries] = await Promise.all([
    VisitorProfileModel.aggregate([
      {
        $group: {
          _id: null,
          totalUniqueVisitors: { $sum: 1 },
          totalVisits: { $sum: "$visitCount" },
          totalPageViews: { $sum: "$pageViewCount" },
          totalEngagementMs: { $sum: "$totalEngagementMs" },
          returningVisitors: {
            $sum: { $cond: [{ $gt: ["$visitCount", 1] }, 1, 0] },
          },
          engagedVisitors: {
            $sum: { $cond: [{ $gte: ["$totalEngagementMs", 30000] }, 1, 0] },
          },
          cityResolvedVisitors: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$city", null] },
                    { $ne: ["$city", ""] },
                    { $ne: ["$city", UNKNOWN_VALUE] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          oldestVisitorAt: { $min: "$firstSeenAt" },
        },
      },
    ]),
    VisitorProfileModel.distinct("country", {
      country: { $nin: [null, "", UNKNOWN_VALUE] },
    }).then((countries) => countries.length),
  ]);
  const profileSummary = profileSummaryAggregate[0] || {};
  const totalUniqueVisitors = profileSummary.totalUniqueVisitors || 0;
  const totalVisits = profileSummary.totalVisits || 0;
  const totalPageViews = profileSummary.totalPageViews || 0;
  const totalEngagementMs = profileSummary.totalEngagementMs || 0;
  const returningVisitors = profileSummary.returningVisitors || 0;
  const engagedVisitors = profileSummary.engagedVisitors || 0;
  const cityResolvedVisitors = profileSummary.cityResolvedVisitors || 0;

  return {
    totalUniqueVisitors,
    totalVisits,
    totalPageViews,
    totalCountries,
    totalEngagementMs,
    returningVisitors,
    engagedVisitors,
    returningVisitorRate: totalUniqueVisitors
      ? returningVisitors / totalUniqueVisitors
      : 0,
    engagementRate: totalUniqueVisitors ? engagedVisitors / totalUniqueVisitors : 0,
    pagesPerVisit: totalVisits ? totalPageViews / totalVisits : 0,
    cityResolvedVisitors,
    cityUnknownVisitors: Math.max(0, totalUniqueVisitors - cityResolvedVisitors),
    cityCoverageRate: totalUniqueVisitors
      ? cityResolvedVisitors / totalUniqueVisitors
      : 0,
    oldestVisitorAt: profileSummary.oldestVisitorAt || null,
    averageEngagementMsPerVisitor: totalUniqueVisitors
      ? Math.round(totalEngagementMs / totalUniqueVisitors)
      : 0,
    averageEngagementMsPerVisit: totalVisits
      ? Math.round(totalEngagementMs / totalVisits)
      : 0,
    lastUpdatedAt: new Date().toISOString(),
  };
};

const fetchVisitorProfiles = async (limit = null) => {
  let query = VisitorProfileModel.find()
    .sort({ lastSeenAt: -1 })
    .select(VISITOR_PROFILE_FIELDS);

  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  return query.lean();
};

const aggregateProfileDimension = (
  expression,
  { fallback = "Unattributed", exclude = [] } = {}
) =>
  VisitorProfileModel.aggregate([
    {
      $group: {
        _id: { $ifNull: [expression, fallback] },
        visitors: { $sum: 1 },
        visits: { $sum: { $ifNull: ["$visitCount", 0] } },
      },
    },
    ...(exclude.length
      ? [{ $match: { _id: { $nin: exclude } } }]
      : []),
    { $sort: { visitors: -1, _id: 1 } },
    { $limit: 8 },
  ]);

export const buildVisitorAnalytics = async ({ includeAllVisitors = false } = {}) => {
  const activeWindow = (days) => ({
    lastSeenAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  });
  const popularPagesWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const [
    summary,
    activeVisitorsLast7Days,
    activeVisitorsLast30Days,
    topCountries,
    topCities,
    topSources,
    topChannels,
    topCampaigns,
    topLandingPages,
    topReferrers,
    deviceTypes,
    browsers,
    operatingSystems,
    visitorProfiles,
    dailyTraffic,
    popularPages,
  ] = await Promise.all([
    buildVisitorSummary(),
    VisitorProfileModel.countDocuments(activeWindow(7)),
    VisitorProfileModel.countDocuments(activeWindow(30)),
    aggregateProfileDimension("$country", {
      fallback: UNKNOWN_VALUE,
      exclude: [null, "", UNKNOWN_VALUE],
    }),
    VisitorProfileModel.aggregate([
      { $match: { city: { $nin: [null, "", UNKNOWN_VALUE] } } },
      {
        $group: {
          _id: { city: "$city", region: "$region", country: "$country" },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { visitors: -1, "_id.city": 1 } },
      { $limit: 8 },
    ]),
    aggregateProfileDimension("$firstAcquisition.source"),
    aggregateProfileDimension("$firstAcquisition.channel"),
    aggregateProfileDimension("$firstAcquisition.campaign", {
      fallback: "",
      exclude: [null, ""],
    }),
    aggregateProfileDimension({
      $ifNull: ["$firstAcquisition.landingPage", "$firstPage"],
    }),
    aggregateProfileDimension("$firstAcquisition.referrerHost", {
      fallback: "",
      exclude: [null, ""],
    }),
    aggregateProfileDimension("$device.type", { fallback: "Unclassified" }),
    aggregateProfileDimension("$device.browser", { fallback: "Unclassified" }),
    aggregateProfileDimension("$device.operatingSystem", {
      fallback: "Unclassified",
    }),
    includeAllVisitors
      ? fetchVisitorProfiles()
      : fetchVisitorProfiles(RECENT_VISITOR_LIMIT),
    VisitorInteractionModel.aggregate([
      { $match: { eventType: "page_view" } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
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

  const recentVisitors = includeAllVisitors
    ? visitorProfiles.slice(0, RECENT_VISITOR_LIMIT)
    : visitorProfiles;
  const mapDimension = (items, key) =>
    items.map((item) => ({
      [key]: item._id,
      visitors: item.visitors,
      visits: item.visits,
    }));

  return {
    summary: {
      ...summary,
      activeVisitorsLast7Days,
      activeVisitorsLast30Days,
    },
    topCountries: mapDimension(topCountries, "country"),
    topCities: topCities.map((item) => ({
      city: item._id.city,
      region: item._id.region,
      country: item._id.country,
      visitors: item.visitors,
    })),
    topSources: mapDimension(topSources, "source"),
    topChannels: mapDimension(topChannels, "channel"),
    topCampaigns: mapDimension(topCampaigns, "campaign"),
    topLandingPages: mapDimension(topLandingPages, "landingPage"),
    topReferrers: mapDimension(topReferrers, "referrer"),
    deviceBreakdown: mapDimension(deviceTypes, "device"),
    browserBreakdown: mapDimension(browsers, "browser"),
    operatingSystemBreakdown: mapDimension(operatingSystems, "operatingSystem"),
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
    visitorRecords: {
      total: summary.totalUniqueVisitors,
      returned: recentVisitors.length,
      defaultLimit: RECENT_VISITOR_LIMIT,
      retentionPolicy: "all_time",
      automaticDeletionEnabled: false,
      oldestRetainedAt: summary.oldestVisitorAt,
    },
    ...(includeAllVisitors ? { allVisitors: visitorProfiles } : {}),
  };
};
