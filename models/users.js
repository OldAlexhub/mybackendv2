import mongoose from "mongoose";
import validator from "validator";

const UsersSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Email is incorrect",
      },
    },
    password: {
      type: String,
      minlength: 8,
      required: true,
      select: false,
    },
    confirmPassword: {
      type: String,
      select: false,
      validate: {
        validator: function (value) {
          return value === this.password;
        },
        message: "Passwords don't match!",
      },
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("users", UsersSchema);

export default UserModel;
