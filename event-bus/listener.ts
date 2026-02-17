import { batchTraceSchema } from "../shared/validation";
import { storage } from "../db/sqlite";
import { ingestTraceBatchIdempotent } from "../services/traces";
import type { TraceIngestEventPayload } from "./subjects";
import { WALReader, WALIndex, type WALConfig } from "./wal";
import { WALCheckpoint } from "./checkpoint";
import { DeadLetterQueue } from "./dead-letter";
import type { WALRecord } from "./wal-record";

export class TraceStreamListener {
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

    console.log("WAL trace listener started");

    // Poll for new records
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

      console.log(`[WAL listener] Processing ${records.length} records`);

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
            console.error(
              `Trace processing error (attempt ${retries + 1}/${this.maxRetries}):`,
              err,
            );
            break;
          } else {
            console.error(
              `Trace processing failed after ${this.maxRetries} retries, sending to DLQ:`,
              err,
            );
            await this.dlq.write(record, String(err), this.maxRetries);
            this.retryCount.delete(record.sequence);
            maxProcessedSequence = record.sequence;
          }
        }
      }

      if (maxProcessedSequence !== null) {
        await this.reader.markNextSequence(maxProcessedSequence + 1);
      }
    } catch (err) {
      console.error("WAL listener error:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processRecord(record: WALRecord): Promise<void> {
    const payload = record.payload;

    if (!payload.projectId) {
      throw new Error("Trace event missing projectId");
    }

    const traces = batchTraceSchema.parse(payload.traces);

    // Use idempotent insert for WAL processing (handles crash recovery duplicates)
    await ingestTraceBatchIdempotent(payload.projectId, traces, storage);
  }
}
