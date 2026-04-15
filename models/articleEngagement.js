import mongoose from "mongoose";

const ArticleCommentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1200,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ArticleEngagementSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      minlength: 1,
      maxlength: 180,
    },
    articleTitle: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    likedBy: {
      type: [String],
      default: [],
    },
    shares: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: {
      type: [ArticleCommentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const ArticleEngagementModel = mongoose.model(
  "ArticleEngagement",
  ArticleEngagementSchema
);

export default ArticleEngagementModel;
