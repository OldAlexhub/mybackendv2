import VisitorInteractionModel from "../models/visitors.js";

const VisitorData = async (req, res) => {
  try {
    const { sessionId, eventType, targetElement, articleId, pageUrl } =
      req.body;

    // Get client metadata
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const referrer = req.headers["referer"] || "Direct";

    // Validate required fields
    if (!sessionId || !eventType || !pageUrl) {
      return res.status(400).json({ message: "Missing required fields!" });
    }

    // Create a new interaction log
    const newInteraction = new VisitorInteractionModel({
      sessionId,
      ipAddress,
      userAgent,
      referrer,
      eventType,
      targetElement,
      articleId,
      pageUrl,
    });

    // Save interaction to database
    await newInteraction.save();

    return res
      .status(201)
      .json({ message: "Interaction logged successfully!" });
  } catch (error) {
    console.error("TrackInteraction Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default VisitorData;
