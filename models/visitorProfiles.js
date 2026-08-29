import mongoose from "mongoose";
import { AcquisitionSchema, DeviceSchema } from "./analyticsSubschemas.js";

const VisitorProfileSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: true,
      default: "Unknown",
    },
    userAgent: {
      type: String,
      required: true,
      default: "Unknown",
    },
    referrer: {
      type: String,
      default: "Direct",
    },
    firstAcquisition: {
      type: AcquisitionSchema,
      default: undefined,
    },
    latestAcquisition: {
      type: AcquisitionSchema,
      default: undefined,
    },
    device: {
      type: DeviceSchema,
      default: undefined,
    },
    firstPage: {
      type: String,
      default: "/",
    },
    lastPage: {
      type: String,
      default: "/",
    },
    country: {
      type: String,
      default: "Unknown",
      index: true,
    },
    region: {
      type: String,
      default: "Unknown",
    },
    city: {
      type: String,
      default: "Unknown",
      index: true,
    },
    timezone: {
      type: String,
      default: "Unknown",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    locationSource: {
      type: String,
      enum: ["edge", "geoip", "edge+geoip", "unavailable"],
      default: "unavailable",
    },
    locationUpdatedAt: {
      type: Date,
      default: null,
    },
    visitCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    pageViewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEngagementMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastVisitAt: {
      type: Date,
      default: Date.now,
    },
    clientSignals: {
      cookiesEnabled: {
        type: Boolean,
        default: null,
      },
      cookieCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      cookieNames: {
        type: [String],
        default: [],
      },
      localStorageItemCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      localStorageBytes: {
        type: Number,
        default: 0,
        min: 0,
      },
      sessionStorageItemCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      sessionStorageBytes: {
        type: Number,
        default: 0,
        min: 0,
      },
      cacheStorageSupported: {
        type: Boolean,
        default: null,
      },
      cacheBucketCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      cacheEntryCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastCapturedAt: {
        type: Date,
        default: null,
      },
    },
  },
  // Visitor history is intentionally retained: do not add an `expires` option
  // or TTL index to this schema.
  { timestamps: true }
);

const VisitorProfileModel = mongoose.model(
  "VisitorProfile",
  VisitorProfileSchema
);

export default VisitorProfileModel;
