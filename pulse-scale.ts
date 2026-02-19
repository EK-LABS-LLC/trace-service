if (!process.env.PULSE_MODE) {
  process.env.PULSE_MODE = "scale";
}

const { initializeRuntimeServices } = await import("./runtime/services");
const { createScaleRuntimeServices } = await import("./runtime/modes/scale");
initializeRuntimeServices(createScaleRuntimeServices());

const { startPulseServer } = await import("./server");
await startPulseServer();
