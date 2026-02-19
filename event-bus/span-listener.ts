import { batchSpanSchema } from "../shared/validation";
import { storage } from "../db";
import { ingestSpanBatchIdempotent } from "../services/spans";
import { WALReader, WALIndex, type WALConfig } from "./wal";
import { WALCheckpoint } from "./checkpoint";
import { DeadLetterQueue } from "./dead-letter";
import type { WALRecord } from "./wal-record";
import type { SpanIngestEventPayload } from "./subjects";

export class SpanStreamListener {
  private reader?: WALReader;
  private stopped = false;
  private isProcessing = false;
  private readonly retryCount = new Map<number, number>();
  private readonly dlq: DeadLetterQueue;
  private processingTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: WALConfig,
    private readonly checkpoint: WALCheckpoint,
    private readonly maxRetries: number = 3,
  ) {
    this.dlq = new DeadLetterQueue(config.walDir + "/dead-letter");
  }

  async start(): Promise<void> {
    const index = new WALIndex(this.config.walDir);

    this.reader = new WALReader(this.config, this.checkpoint, index);
    this.stopped = false;

    this.processingTimer = setInterval(() => {
      void this.processBatch();
    }, 100);
  }

  stop(): void {
    this.stopped = true;
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.stopped || !this.reader || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const records: WALRecord[] = [];
      const maxBatchSize = 100;

      for await (const record of this.reader.read()) {
        records.push(record);
        if (records.length >= maxBatchSize) {
          break;
        }
      }

      if (records.length === 0) {
        return;
      }

      let maxProcessedSequence: number | null = null;

      for (const record of records) {
        if (this.stopped) break;

        try {
          await this.processRecord(record);
          this.retryCount.delete(record.sequence);
          maxProcessedSequence = record.sequence;
        } catch (err) {
          const retries = this.retryCount.get(record.sequence) ?? 0;

          if (retries < this.maxRetries) {
            this.retryCount.set(record.sequence, retries + 1);
            break;
          } else {
            await this.dlq.write(record, String(err), this.maxRetries);
            this.retryCount.delete(record.sequence);
            maxProcessedSequence = record.sequence;
          }
        }
      }

      if (maxProcessedSequence !== null) {
        await this.reader.markNextSequence(maxProcessedSequence + 1);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processRecord(record: WALRecord): Promise<void> {
    const payload = record.payload as SpanIngestEventPayload;

    if (!payload.projectId) {
      throw new Error("Span event missing projectId");
    }

    const spans = batchSpanSchema.parse(payload.spans);
    await ingestSpanBatchIdempotent(payload.projectId, spans, storage);
  }
}
