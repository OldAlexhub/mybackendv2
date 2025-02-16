import ArticleModel from "../models/articles.js";

const GetArticles = async (req, res) => {
  try {
    // Fetch all articles sorted by most recent first
    const articles = await ArticleModel.find().sort({ date: -1 });

    // If no articles found
    if (!articles || articles.length === 0) {
      return res.status(404).json({ message: "No articles found!" });
    }

    // Return articles
    return res.status(200).json({ articles });
  } catch (error) {
    console.error("GetArticles Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default GetArticles;
