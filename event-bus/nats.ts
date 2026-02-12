import {
  jetstream,
  jetstreamManager,
  type JetStreamClient,
  type JetStreamManager,
} from "@nats-io/jetstream";
import type { NatsConnection } from "@nats-io/nats-core";
import { connect } from "@nats-io/transport-node";
import { env } from "../config";

export class NatsJetStreamEventBus {
  private connection?: NatsConnection;
  private js?: JetStreamClient;
  private jsm?: JetStreamManager;

  async connect(): Promise<void> {
    if (this.connection) return;

    this.connection = await connect({ servers: env.NATS_URL });
    this.js = jetstream(this.connection);
    this.jsm = await jetstreamManager(this.connection);
    console.log(`Connected to NATS at ${env.NATS_URL}`);
  }

  async close(): Promise<void> {
    if (!this.connection) return;

    await this.connection.close();
    this.connection = undefined;
    this.js = undefined;
    this.jsm = undefined;
    console.log("NATS connection closed");
  }

  getJetStreamClient(): JetStreamClient {
    if (!this.js) {
      throw new Error("NATS connection is not initialized");
    }
    return this.js;
  }

  getJetStreamManager(): JetStreamManager {
    if (!this.jsm) {
      throw new Error("NATS connection is not initialized");
    }
    return this.jsm;
  }

  async publish(subject: string, payload: unknown): Promise<void> {
    const js = this.getJetStreamClient();
    await js.publish(subject, JSON.stringify(payload));
  }
}
