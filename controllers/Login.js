import UserModel from "../models/users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({ message: `User not found!` });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: `Wrong Password!` });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({ message: `Login Successful`, token });
  } catch (error) {
    console.error(`Login error:`, error);
    return res
      .status(500)
      .json({ message: `Server Error`, error: error.message });
  }
};

export default login;
