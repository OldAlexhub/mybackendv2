import AndroidAppModel from "../models/androidApps.js";

const DeleteAndroidApp = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AndroidAppModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "App not found." });
    }

    return res.status(200).json({ message: "App deleted successfully." });
  } catch (error) {
    console.error("DeleteAndroidApp Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export default DeleteAndroidApp;
