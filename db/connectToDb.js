import mongoose from "mongoose";

const connectToDb = async () => {
  try {
    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL is not configured.");
    }

    await mongoose.connect(process.env.MONGO_URL);

    console.log(`Connected to MongoDb`);
  } catch (error) {
    console.error(`Failed to connect to MongoDB:`, error.message);
    throw error;
  }
};

export default connectToDb;
