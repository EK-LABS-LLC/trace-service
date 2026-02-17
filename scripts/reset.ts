import { db } from "../db";
import {
  apiKeys,
  userProjects,
  traces,
  sessions,
  projects,
  subscriptions,
} from "../db/schema";

/**
 * Reset database - clears all data from all tables.
 * This is useful for development/testing to start fresh.
 */
async function reset() {
  console.log("⚠️  Clearing all database tables...");

  // Delete in correct order due to foreign key constraints
  await db.delete(traces);
  console.log("  ✓ Cleared traces");

  await db.delete(sessions);
  console.log("  ✓ Cleared sessions");

  await db.delete(apiKeys);
  console.log("  ✓ Cleared api_keys");

  await db.delete(userProjects);
  console.log("  ✓ Cleared user_projects");

  await db.delete(projects);
  console.log("  ✓ Cleared projects");

  await db.delete(subscriptions);
  console.log("  ✓ Cleared subscriptions");

  console.log("✅ Database reset complete!");
}

reset()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  });
