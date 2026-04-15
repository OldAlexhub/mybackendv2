import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";
import {
  buildArticleEngagementResponse,
  normalizeArticleSlug,
} from "../utils/articleEngagement.js";

const PostArticleComment = async (req, res) => {
  try {
    const slug = normalizeArticleSlug(req.params.slug);
    const articleTitle = `${req.body.articleTitle || ""}`.trim();
    const name = `${req.body.name || ""}`.trim();
    const message = `${req.body.message || ""}`.trim();

    if (!slug) {
      return res.status(400).json({ message: "Article slug is required." });
    }

    if (!name || !message) {
      return res.status(400).json({
        message: "Name and comment are required.",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Comments are temporarily unavailable. Please try again shortly.",
      });
    }

    let engagement = await ArticleEngagementModel.findOne({ slug });

    if (!engagement) {
      engagement = new ArticleEngagementModel({
        slug,
        articleTitle,
      });
    } else if (articleTitle && !engagement.articleTitle) {
      engagement.articleTitle = articleTitle;
    }

    engagement.comments.push({ name, message });
    await engagement.save();

    const responsePayload = buildArticleEngagementResponse(engagement);

    return res.status(201).json({
      ...responsePayload,
      comment: responsePayload.comments[0],
      message: "Comment recorded successfully.",
    });
  } catch (error) {
    console.error("PostArticleComment Error:", error);

    if (error.name === "ValidationError") {
      const validationMessage = Object.values(error.errors)
        .map((item) => item.message)
        .join(" ");

      return res.status(400).json({
        message:
          validationMessage ||
          "Please review the comment fields and try again.",
      });
    }

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default PostArticleComment;
