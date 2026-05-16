import mongoose from "mongoose";

const AndroidAppSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    packageName: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "deprecated"],
      default: "active",
    },
    playStoreLink: {
      type: String,
      trim: true,
      default: "",
    },
    githubLink: {
      type: String,
      trim: true,
      default: "",
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

const AndroidAppModel = mongoose.model("AndroidApp", AndroidAppSchema);

export default AndroidAppModel;
