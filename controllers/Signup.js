import mongoose from "mongoose";
import UserModel from "../models/users.js";
import bcrypt from "bcrypt";

const Signup = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      res.status(400).json({ message: `User already exists!` });
    }

    if (password != confirmPassword) {
      res.status(400).json({ message: `Passwords don't match!` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new UserModel({
      email: email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: `User created successfully!` });
  } catch (error) {
    res.status(500).json({ message: `Server Error` });
    console.log(error);
  }
};

export default Signup;
