import mongoose from "mongoose";
import { AcquisitionSchema, DeviceSchema } from "./analyticsSubschemas.js";

const VisitorInteractionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true, // Helps track user behavior across multiple interactions
      index: true, // Optimizes lookups
    },
    ipAddress: {
      type: String, // To track visitor origin (privacy-sensitive)
      required: true,
    },
    userAgent: {
      type: String, // Captures browser, device, and OS details
      required: true,
    },
    referrer: {
      type: String, // Captures the previous URL (e.g., Google, another site)
      default: "Direct",
    },
    acquisition: {
      type: AcquisitionSchema,
      default: undefined,
    },
    device: {
      type: DeviceSchema,
      default: undefined,
    },
    isVisitStart: {
      type: Boolean,
      default: false,
      index: true,
    },
    isReturningVisit: {
      type: Boolean,
      default: false,
    },
    eventType: {
      type: String,
      enum: [
        "click",
        "page_view",
        "scroll",
        "hover",
        "form_submission",
        "engagement",
      ],
      required: true,
    },
    targetElement: {
      type: String, // Identifies which button, link, or element was interacted with
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId, // Tracks which article was read
      ref: "Article",
      default: null,
    },
    pageUrl: {
      type: String, // The URL of the page visited
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now, // Records the time of interaction
      required: true,
    },
    engagementMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  // Interaction history is intentionally retained: do not add an `expires`
  // option or TTL index to this schema.
  { timestamps: true } // Adds `createdAt` and `updatedAt`
);

const VisitorInteractionModel = mongoose.model(
  "VisitorInteraction",
  VisitorInteractionSchema
);

export default VisitorInteractionModel;
