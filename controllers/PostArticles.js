import ArticleModel from "../models/articles.js";

const PostArticle = async (req, res) => {
  try {
    const { title, subtitle, publishedBy, image, sections, demoLink } =
      req.body;

    // Check if all required fields exist
    if (
      !title ||
      !subtitle ||
      !publishedBy ||
      !image ||
      !sections ||
      !demoLink
    ) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    // Check if article with same title exists (Optional)
    const existingArticle = await ArticleModel.findOne({ title });
    if (existingArticle) {
      return res
        .status(400)
        .json({ message: "An article with this title already exists!" });
    }

    // Create new article
    const newArticle = new ArticleModel({
      title,
      subtitle,
      publishedBy,
      image,
      sections,
      demoLink,
    });

    // Save to database
    await newArticle.save();

    return res.status(201).json({
      message: "Article posted successfully!",
      article: newArticle,
    });
  } catch (error) {
    console.error("PostArticle Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default PostArticle;
