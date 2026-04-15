import { buildArticleEngagementAnalytics } from "../utils/articleEngagementAnalytics.js";

const GetArticleEngagementAnalytics = async (req, res) => {
  try {
    const analytics = await buildArticleEngagementAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    console.error("GetArticleEngagementAnalytics Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

export default GetArticleEngagementAnalytics;
