import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "bun",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:.data/pulse.db",
  },
});
