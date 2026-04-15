import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";
import {
  buildArticleEngagementResponse,
  normalizeArticleSlug,
  normalizeVisitorId,
} from "../utils/articleEngagement.js";

const PostArticleShare = async (req, res) => {
  try {
    const slug = normalizeArticleSlug(req.params.slug);
    const articleTitle = `${req.body.articleTitle || ""}`.trim();
    const visitorId = normalizeVisitorId(req.body.visitorId);

    if (!slug) {
      return res.status(400).json({ message: "Article slug is required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Article shares are temporarily unavailable. Please try again shortly.",
      });
    }

    let engagement = await ArticleEngagementModel.findOne({ slug });

    if (!engagement) {
      engagement = new ArticleEngagementModel({
        slug,
        articleTitle,
        shares: 1,
      });
    } else {
      engagement.shares = (engagement.shares || 0) + 1;

      if (articleTitle && !engagement.articleTitle) {
        engagement.articleTitle = articleTitle;
      }
    }

    await engagement.save();

    return res.status(201).json({
      ...buildArticleEngagementResponse(engagement, visitorId),
      message: "Share recorded successfully.",
    });
  } catch (error) {
    console.error("PostArticleShare Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default PostArticleShare;
