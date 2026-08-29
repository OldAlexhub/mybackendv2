import mongoose from "mongoose";

export const AcquisitionSchema = new mongoose.Schema(
  {
    source: { type: String, default: "Direct" },
    medium: { type: String, default: "none" },
    channel: { type: String, default: "Direct" },
    campaign: { type: String, default: "" },
    term: { type: String, default: "" },
    content: { type: String, default: "" },
    referrer: { type: String, default: "" },
    referrerHost: { type: String, default: "" },
    landingPage: { type: String, default: "/" },
    clickProvider: { type: String, default: "" },
    redirectCount: { type: Number, default: 0, min: 0 },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const DeviceSchema = new mongoose.Schema(
  {
    type: { type: String, default: "Desktop" },
    browser: { type: String, default: "Other" },
    operatingSystem: { type: String, default: "Other" },
  },
  { _id: false }
);
