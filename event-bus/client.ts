import { NatsJetStreamEventBus } from "./nats";

const eventBus = new NatsJetStreamEventBus();

export function getEventBus(): NatsJetStreamEventBus {
  return eventBus;
}

export async function startNatsConnection(): Promise<void> {
  await eventBus.connect();
}

export async function stopNatsConnection(): Promise<void> {
  await eventBus.close();
}
