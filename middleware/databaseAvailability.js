import mongoose from "mongoose";

const requireDatabase = (_req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    error: "This database-backed service is temporarily unavailable.",
    databaseRequired: true,
  });
};

export default requireDatabase;

