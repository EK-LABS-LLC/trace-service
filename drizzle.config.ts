import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema-single.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || ".data/pulse.db",
  },
});
