import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";
import {
  buildArticleEngagementResponse,
  normalizeArticleSlug,
  normalizeVisitorId,
} from "../utils/articleEngagement.js";

const PostArticleLike = async (req, res) => {
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
          "Article likes are temporarily unavailable. Please try again shortly.",
      });
    }

    let engagement = await ArticleEngagementModel.findOne({ slug });
    let alreadyLiked = false;

    if (!engagement) {
      engagement = new ArticleEngagementModel({
        slug,
        articleTitle,
        likes: 1,
        ...(visitorId ? { likedBy: [visitorId] } : {}),
      });
    } else {
      engagement.likedBy = engagement.likedBy || [];
      alreadyLiked = visitorId
        ? engagement.likedBy.includes(visitorId)
        : false;

      if (!alreadyLiked) {
        engagement.likes = (engagement.likes || 0) + 1;

        if (visitorId) {
          engagement.likedBy.push(visitorId);
        }
      }

      if (articleTitle && !engagement.articleTitle) {
        engagement.articleTitle = articleTitle;
      }
    }

    await engagement.save();

    return res.status(alreadyLiked ? 200 : 201).json({
      ...buildArticleEngagementResponse(engagement, visitorId),
      alreadyLiked,
      message: alreadyLiked
        ? "Like already counted for this visitor."
        : "Like recorded successfully.",
    });
  } catch (error) {
    console.error("PostArticleLike Error:", error);

    if (error.code === 11000) {
      const slug = normalizeArticleSlug(req.params.slug);
      const visitorId = normalizeVisitorId(req.body.visitorId);
      const engagement = await ArticleEngagementModel.findOne({ slug });

      if (engagement) {
        return res.status(200).json({
          ...buildArticleEngagementResponse(engagement, visitorId),
          alreadyLiked: visitorId
            ? (engagement.likedBy || []).includes(visitorId)
            : false,
          message: "Like state refreshed.",
        });
      }
    }

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default PostArticleLike;
