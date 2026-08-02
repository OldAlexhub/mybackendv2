import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import routes from "./routes/routes.js";
import connectToDb from "./db/connectToDb.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.urlencoded({ limit: "32mb", extended: true }));
app.use(express.json({ limit: "32mb" }));

const publicDirectory = path.join(__dirname, "./public");
app.use(express.static(publicDirectory));
app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.sendFile(path.join(publicDirectory, "sitemap.xml"));
});

app.use(routes);

connectToDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(() => {
    process.exitCode = 1;
  });
