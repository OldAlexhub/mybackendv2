import dotenv from "dotenv";
import connectToDb from "./db/connectToDb.js";
import { createApp } from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = createApp();

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  void connectToDb().catch((error) => {
    console.error(
      `MongoDB is unavailable; transit and static services remain online: ${error.message}`
    );
  });
};

startServer();
