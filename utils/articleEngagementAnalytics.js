import mongoose from "mongoose";
import ArticleEngagementModel from "../models/articleEngagement.js";

const EMPTY_SUMMARY = {
  trackedArticles: 0,
  totalLikes: 0,
  totalComments: 0,
  totalShares: 0,
  totalEngagements: 0,
  articlesWithLikes: 0,
  articlesWithComments: 0,
  articlesWithShares: 0,
  lastEngagementAt: null,
};

export const buildArticleEngagementAnalytics = async () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Article engagement analytics are unavailable.");
  }

  const [summaryRows, topArticles, recentComments] = await Promise.all([
    ArticleEngagementModel.aggregate([
      {
        $project: {
          likes: { $ifNull: ["$likes", 0] },
          shares: { $ifNull: ["$shares", 0] },
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
          updatedAt: 1,
        },
      },
      {
        $group: {
          _id: null,
          trackedArticles: { $sum: 1 },
          totalLikes: { $sum: "$likes" },
          totalComments: { $sum: "$commentsCount" },
          totalShares: { $sum: "$shares" },
          articlesWithLikes: {
            $sum: { $cond: [{ $gt: ["$likes", 0] }, 1, 0] },
          },
          articlesWithComments: {
            $sum: { $cond: [{ $gt: ["$commentsCount", 0] }, 1, 0] },
          },
          articlesWithShares: {
            $sum: { $cond: [{ $gt: ["$shares", 0] }, 1, 0] },
          },
          lastEngagementAt: { $max: "$updatedAt" },
        },
      },
      {
        $addFields: {
          totalEngagements: {
            $add: ["$totalLikes", "$totalComments", "$totalShares"],
          },
        },
      },
    ]),
    ArticleEngagementModel.aggregate([
      {
        $project: {
          slug: 1,
          articleTitle: 1,
          likes: { $ifNull: ["$likes", 0] },
          shares: { $ifNull: ["$shares", 0] },
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
          updatedAt: 1,
        },
      },
      {
        $addFields: {
          totalEngagements: {
            $add: ["$likes", "$commentsCount", "$shares"],
          },
        },
      },
      {
        $sort: {
          totalEngagements: -1,
          likes: -1,
          commentsCount: -1,
          shares: -1,
          updatedAt: -1,
        },
      },
      { $limit: 8 },
    ]),
    ArticleEngagementModel.aggregate([
      {
        $project: {
          slug: 1,
          articleTitle: 1,
          comments: { $ifNull: ["$comments", []] },
        },
      },
      { $unwind: "$comments" },
      { $sort: { "comments.createdAt": -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          id: "$comments._id",
          slug: 1,
          articleTitle: 1,
          name: "$comments.name",
          message: "$comments.message",
          createdAt: "$comments.createdAt",
        },
      },
    ]),
  ]);

  return {
    summary: summaryRows[0] || EMPTY_SUMMARY,
    topArticles,
    recentComments,
  };
};
