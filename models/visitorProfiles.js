import mongoose from "mongoose";

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
    visitCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    pageViewCount: {
      type: Number,
      default: 1,
      min: 1,
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
  },
  { timestamps: true }
);

const VisitorProfileModel = mongoose.model(
  "VisitorProfile",
  VisitorProfileSchema
);

export default VisitorProfileModel;
