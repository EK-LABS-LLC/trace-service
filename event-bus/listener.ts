import type { ConsumerMessages } from "@nats-io/jetstream";
import { batchTraceSchema } from "../shared/validation";
import { storage } from "../db/postgres";
import { ingestTraceBatch } from "../services/traces";
import { ConsumerNotFoundError } from "./errors";
import { NatsJetStreamEventBus } from "./nats";
import { type TraceIngestEventPayload } from "./subjects";

export class TraceStreamListener {
  private readonly decoder = new TextDecoder();
  private messages?: ConsumerMessages;
  private stopped = false;

  constructor(
    private readonly bus: NatsJetStreamEventBus,
    private readonly stream: string,
    private readonly durableName: string
  ) {}

  async start(): Promise<void> {
    const js = this.bus.getJetStreamClient();

    let consumer;
    try {
      consumer = await js.consumers.get(this.stream, this.durableName);
    } catch (err) {
      throw new ConsumerNotFoundError(
        `Consumer ${this.durableName} missing on stream ${this.stream}: ${err}`
      );
    }

    this.messages = await consumer.consume();
    console.log(`Trace consumer ${this.durableName} started`);

    void this.processLoop();
  }

  stop(): void {
    this.stopped = true;
    this.messages?.stop();
  }

  private async processLoop(): Promise<void> {
    const messages = this.messages;
    if (!messages) return;

    for await (const msg of messages) {
      if (this.stopped) break;
      try {
        const event = this.decodePayload(msg.data);
        await this.handleTrace(event);
        msg.ack();
      } catch (err) {
        console.error("Trace handler error:", err);
        msg.nak();
      }
    }
  }

  private decodePayload(data: Uint8Array): TraceIngestEventPayload {
    if (!data || data.length === 0) {
      throw new Error("Empty trace payload");
    }
    return JSON.parse(this.decoder.decode(data)) as TraceIngestEventPayload;
  }

  private async handleTrace(payload: TraceIngestEventPayload): Promise<void> {
    if (!payload.projectId) {
      throw new Error("Trace event missing projectId");
    }
    const traces = batchTraceSchema.parse(payload.traces);
    await ingestTraceBatch(payload.projectId, traces, storage);
  }
}
