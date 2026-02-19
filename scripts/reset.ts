if (!process.env.PULSE_MODE) {
  process.env.PULSE_MODE = "single";
}

const { initializeRuntimeServices } = await import("../runtime/services");
if (process.env.PULSE_MODE === "scale") {
  const { createScaleRuntimeServices } = await import("../runtime/modes/scale");
  initializeRuntimeServices(createScaleRuntimeServices());
} else {
  const { createSingleRuntimeServices } = await import("../runtime/modes/single");
  initializeRuntimeServices(createSingleRuntimeServices());
}

const { db } = await import("../db");
const { apiKeys, userProjects, traces, sessions, projects } = await import("../db/schema");

/**
 * Reset database - clears all data from all tables.
 * This is useful for development/testing to start fresh.
 */
async function reset() {
  console.log("Clearing all database tables...");

  // Delete in correct order due to foreign key constraints.
  await db.delete(traces);
  console.log("  cleared traces");

  await db.delete(sessions);
  console.log("  cleared sessions");

  await db.delete(apiKeys);
  console.log("  cleared api_keys");

  await db.delete(userProjects);
  console.log("  cleared user_projects");

  await db.delete(projects);
  console.log("  cleared projects");

  console.log("Database reset complete");
}

reset()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
