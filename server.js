import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import connectToDb from "./db/connectToDb.js";
import routes from "./routes/routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT | 3001;

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.urlencoded({ limit: "32mb", extended: true }));
app.use(express.json({ limit: "32mb", extended: true }));

const __direname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__direname, "./public");
app.use(express.static(publicDirectory));

connectToDb();

app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
