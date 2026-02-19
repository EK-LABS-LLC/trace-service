import { defineConfig } from "drizzle-kit";
import { resolveDataPaths } from "./lib/data-paths";

const { databasePath } = resolveDataPaths(process.env);

export default defineConfig({
  schema: "./db/schema-single.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
});
