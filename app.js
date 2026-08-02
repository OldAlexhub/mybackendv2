import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { fileURLToPath } from "url";
import path from "path";
import routes from "./routes/routes.js";
import transitRoutes from "./routes/transitRoutes.js";
import requireDatabase from "./middleware/databaseAvailability.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
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

  app.use("/transit", transitRoutes);
  app.use(requireDatabase, routes);

  return app;
};

export default createApp;

