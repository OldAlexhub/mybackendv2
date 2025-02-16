import { promisify } from "util";
import jwt from "jsonwebtoken";
import UserModel from "../models/users.js";

const protectRoute = async (req, res, next) => {
  //get token
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    //   console.log(token);
    if (!token) {
      return res.status(401).json({ message: `You are not logged in!` });
    }
    //verification
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }
    // console.log(decoded);
    //check user exists
    const currentUser = await UserModel.findById(decoded.userId);
    // console.log(freshUser);
    if (!currentUser) {
      return res.status(401).json({ message: `Token has expired!` });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    res.status(500).json({ message: `Unauthorized!` });
  }
};
export default protectRoute;
