import mongoose from "mongoose";

const connectToDb = async (req, res) => {
  try {
    await mongoose.connect(process.env.MONGO_URL);

    console.log(`Connected to MongoDb`);
  } catch (error) {
    console.log(`Failed to connect to MongoDB`);
  }
};

export default connectToDb;
