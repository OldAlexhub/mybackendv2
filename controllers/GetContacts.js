import ContactModel from "../models/contact.js";

const GetContacts = async (req, res) => {
  try {
    const contacts = await ContactModel.find().sort({ createdAt: -1 });
    return res.status(200).json({ contacts });
  } catch (error) {
    console.error("GetContacts Error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export default GetContacts;
