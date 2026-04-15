import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";
import {
  buildArticleEngagementResponse,
  normalizeArticleSlug,
  normalizeVisitorId,
} from "../utils/articleEngagement.js";

const GetArticleEngagement = async (req, res) => {
  try {
    const slug = normalizeArticleSlug(req.params.slug);
    const visitorId = normalizeVisitorId(req.query.visitorId);

    if (!slug) {
      return res.status(400).json({ message: "Article slug is required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Article engagement is temporarily unavailable. Please try again shortly.",
      });
    }

    const engagement = await ArticleEngagementModel.findOne({ slug }).lean();
    const payload = buildArticleEngagementResponse(
      engagement
        ? {
            ...engagement,
            slug,
          }
        : { slug },
      visitorId
    );

    return res.status(200).json(payload);
  } catch (error) {
    console.error("GetArticleEngagement Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default GetArticleEngagement;
