import { buildVisitorAnalytics } from "../utils/visitorAnalytics.js";

const GetVisitorAnalytics = async (req, res) => {
  try {
    const analytics = await buildVisitorAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    console.error("GetVisitorAnalytics Error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default GetVisitorAnalytics;
