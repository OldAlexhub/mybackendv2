import AndroidAppModel from "../models/androidApps.js";

const UpdateAndroidApp = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, packageName, category, status, iconUrl, rating, playStoreLink, appStoreLink, githubLink, releasedAt, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: "App name is required." });
    }

    const updated = await AndroidAppModel.findByIdAndUpdate(
      id,
      {
        name,
        description,
        packageName,
        category,
        status,
        iconUrl,
        rating: rating === "" || rating === undefined ? null : rating,
        playStoreLink,
        appStoreLink,
        githubLink,
        releasedAt: releasedAt || null,
        notes,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "App not found." });
    }

    return res.status(200).json({ message: "App updated successfully.", app: updated });
  } catch (error) {
    console.error("UpdateAndroidApp Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export default UpdateAndroidApp;
