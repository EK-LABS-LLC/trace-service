if (!process.env.PULSE_MODE) {
  process.env.PULSE_MODE = "single";
}

const mode = process.env.PULSE_MODE;
const { initializeRuntimeServices } = await import("./runtime/services");

if (mode === "single") {
  const { createSingleRuntimeServices } = await import("./runtime/modes/single");
  initializeRuntimeServices(createSingleRuntimeServices());
} else if (mode === "scale") {
  const { createScaleRuntimeServices } = await import("./runtime/modes/scale");
  initializeRuntimeServices(createScaleRuntimeServices());
} else {
  throw new Error(
    `Invalid PULSE_MODE: ${mode}. Expected "single" or "scale".`,
  );
}

const { startPulseServer } = await import("./server");
await startPulseServer();
