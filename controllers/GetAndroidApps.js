import AndroidAppModel from "../models/androidApps.js";

const GetAndroidApps = async (req, res) => {
  try {
    const apps = await AndroidAppModel.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ apps });
  } catch (error) {
    console.error("GetAndroidApps Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export default GetAndroidApps;
