if (!process.env.PULSE_MODE) {
  process.env.PULSE_MODE = "single";
}

const { initializeRuntimeServices } = await import("./runtime/services");
const { createSingleRuntimeServices } = await import("./runtime/modes/single");
initializeRuntimeServices(createSingleRuntimeServices());

const { startPulseServer } = await import("./server");
await startPulseServer();
