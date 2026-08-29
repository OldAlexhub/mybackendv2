import assert from "node:assert/strict";
import test from "node:test";
import VisitorProfileModel from "../models/visitorProfiles.js";
import VisitorInteractionModel from "../models/visitors.js";
import {
  buildVisitorLocationUpdate,
  extractVisitorMetadata,
  normalizeAcquisition,
  parseUserAgent,
  resolveVisitorLocation,
} from "../utils/visitorAnalytics.js";

test("uses the edge-provided client IP before generic proxy headers", () => {
  const metadata = extractVisitorMetadata({
    headers: {
      "cf-connecting-ip": "203.0.113.25",
      "x-forwarded-for": "198.51.100.10, 10.0.0.2",
      "user-agent": "Mozilla/5.0",
    },
    ip: "127.0.0.1",
  });

  assert.equal(metadata.ipAddress, "203.0.113.25");
});

test("uses decoded edge location headers even when the server sees a private IP", () => {
  const location = resolveVisitorLocation("127.0.0.1", {
    "x-vercel-ip-city": "S%C3%A3o+Paulo",
    "x-vercel-ip-country-region": "SP",
    "x-vercel-ip-country": "br",
    "x-vercel-ip-timezone": "America%2FSao_Paulo",
    "x-vercel-ip-latitude": "-23.5505",
    "x-vercel-ip-longitude": "-46.6333",
  });

  assert.equal(location.city, "São Paulo");
  assert.equal(location.region, "SP");
  assert.equal(location.country, "BR");
  assert.equal(location.timezone, "America/Sao_Paulo");
  assert.equal(location.locationSource, "edge");
});

test("does not invent coordinates when no edge or GeoIP location is available", () => {
  const location = resolveVisitorLocation("127.0.0.1");

  assert.equal(location.city, "Unknown");
  assert.equal(location.latitude, null);
  assert.equal(location.longitude, null);
  assert.equal(location.locationSource, "unavailable");
});

test("rejects provider pseudo-country codes that break region formatting", () => {
  const location = resolveVisitorLocation("127.0.0.1", {
    "cf-ipcountry": "T1",
  });

  assert.equal(location.country, "Unknown");
});

test("normalizes acquisition details supplied by the landing page", () => {
  const acquisition = normalizeAcquisition({
    source: "linkedin",
    medium: "social",
    channel: "Organic Social",
    campaign: "article-launch",
    referrer: "https://www.linkedin.com/feed/",
    landingPage: "/articles/example?utm_source=linkedin",
    redirectCount: 2,
  });

  assert.equal(acquisition.referrerHost, "linkedin.com");
  assert.equal(acquisition.campaign, "article-launch");
  assert.equal(acquisition.redirectCount, 2);
});

test("classifies visitor device, browser, and operating system", () => {
  const device = parseUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
  );

  assert.deepEqual(device, {
    type: "Mobile",
    browser: "Safari",
    operatingSystem: "iOS",
  });
});

test("never replaces a known city with an unresolved location", () => {
  const update = buildVisitorLocationUpdate(
    { city: "Boston", country: "US", locationSource: "geoip" },
    {
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      timezone: "Unknown",
      latitude: null,
      longitude: null,
      locationSource: "unavailable",
      locationUpdatedAt: null,
    }
  );

  assert.deepEqual(update, {});
});

test("accepts newly resolved city data for an existing visitor", () => {
  const update = buildVisitorLocationUpdate(
    { city: "Unknown", country: "US", locationSource: "geoip" },
    {
      city: "Atlanta",
      region: "GA",
      country: "US",
      timezone: "America/New_York",
      latitude: 33.749,
      longitude: -84.388,
      locationSource: "edge+geoip",
      locationUpdatedAt: new Date("2026-07-17T12:00:00.000Z"),
    }
  );

  assert.equal(update.city, "Atlanta");
  assert.equal(update.locationSource, "edge+geoip");
  assert.equal(update.latitude, 33.749);
});

test("visitor collections do not define TTL indexes", () => {
  const indexes = [
    ...VisitorProfileModel.schema.indexes(),
    ...VisitorInteractionModel.schema.indexes(),
  ];

  indexes.forEach(([, options]) => {
    assert.equal(options.expireAfterSeconds, undefined);
    assert.equal(options.expires, undefined);
  });
});
