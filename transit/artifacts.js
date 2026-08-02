import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidateDirectories = () =>
  [
    process.env.TRANSIT_DATA_DIR,
    path.resolve(__dirname, "../../client/public/data/transit"),
    path.resolve(__dirname, "../public/data/transit"),
  ].filter(Boolean);

export const readTransitArtifact = async (filename, fallback = null) => {
  for (const directory of candidateDirectories()) {
    try {
      const contents = await fs.readFile(path.join(directory, filename), "utf8");
      return JSON.parse(contents);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Unable to read transit artifact ${filename}:`, error.message);
      }
    }
  }

  return fallback;
};

export const getArtifactDirectoryCandidates = candidateDirectories;

