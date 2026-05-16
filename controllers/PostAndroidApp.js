import AndroidAppModel from "../models/androidApps.js";

const PostAndroidApp = async (req, res) => {
  try {
    const { name, description, packageName, category, status, playStoreLink, githubLink, releasedAt, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: "App name is required." });
    }

    const newApp = new AndroidAppModel({
      name,
      description,
      packageName,
      category,
      status,
      playStoreLink,
      githubLink,
      releasedAt: releasedAt || null,
      notes,
    });

    await newApp.save();

    return res.status(201).json({ message: "App added successfully.", app: newApp });
  } catch (error) {
    console.error("PostAndroidApp Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export default PostAndroidApp;
