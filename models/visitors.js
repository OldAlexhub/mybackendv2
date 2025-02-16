import mongoose from "mongoose";

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
    eventType: {
      type: String,
      enum: ["click", "page_view", "scroll", "hover", "form_submission"],
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
  },
  { timestamps: true } // Adds `createdAt` and `updatedAt`
);

const VisitorInteractionModel = mongoose.model(
  "VisitorInteraction",
  VisitorInteractionSchema
);

export default VisitorInteractionModel;
