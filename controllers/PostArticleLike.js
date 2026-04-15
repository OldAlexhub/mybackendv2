import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";
import { normalizeArticleSlug } from "../utils/articleEngagement.js";

const PostArticleLike = async (req, res) => {
  try {
    const slug = normalizeArticleSlug(req.params.slug);
    const articleTitle = `${req.body.articleTitle || ""}`.trim();

    if (!slug) {
      return res.status(400).json({ message: "Article slug is required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Article likes are temporarily unavailable. Please try again shortly.",
      });
    }

    const update = {
      $inc: { likes: 1 },
      $setOnInsert: {
        slug,
      },
    };

    if (articleTitle) {
      update.$set = { articleTitle };
      update.$setOnInsert.articleTitle = articleTitle;
    }

    const engagement = await ArticleEngagementModel.findOneAndUpdate(
      { slug },
      update,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      slug,
      likes: engagement.likes,
    });
  } catch (error) {
    console.error("PostArticleLike Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default PostArticleLike;
