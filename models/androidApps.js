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
    iconUrl: {
      type: String,
      trim: true,
      default: "",
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    playStoreLink: {
      type: String,
      trim: true,
      default: "",
    },
    appStoreLink: {
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
