import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,

      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    publishedBy: {
      type: String,

      trim: true,
    },
    image: {
      type: String,
    },
    sections: {
      Abstract: { type: String },
      Introduction: { type: String },
      Objectives: { type: [String] },
      Methodology: { type: [String] },
      Features: { type: [String] },
      Challenges: { type: [String] },
      Results_Impact: { type: String },
      Conclusion_Future_Work: { type: String },
    },
    demoLink: {
      type: String,
      required: false,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/[^\s]+$/.test(v);
        },
        message: "Invalid URL format",
      },
    },
  },
  { timestamps: true }
);

const ArticleModel = mongoose.model("Project", ProjectSchema);

export default ArticleModel;
