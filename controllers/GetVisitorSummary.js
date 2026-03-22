import { buildVisitorSummary } from "../utils/visitorAnalytics.js";

const GetVisitorSummary = async (req, res) => {
  try {
    const summary = await buildVisitorSummary();
    return res.status(200).json(summary);
  } catch (error) {
    console.error("GetVisitorSummary Error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default GetVisitorSummary;
