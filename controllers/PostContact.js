import ContactModel from "../models/contact.js";

const PostContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    // Save message
    const newMessage = new ContactModel({
      name,
      email,
      subject,
      message,
    });

    await newMessage.save();

    return res.status(201).json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error("PostContact Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default PostContact;
