import ArticleModel from "../models/articles.js";
import mongoose from "mongoose";

const GetAnArticle = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID!" });
    }

    // Find article by ID
    const article = await ArticleModel.findById(id);

    // If no article found
    if (!article) {
      return res.status(404).json({ message: "Article not found!" });
    }

    // Return article
    return res.status(200).json({ article });
  } catch (error) {
    console.error("GetAnArticle Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default GetAnArticle;
