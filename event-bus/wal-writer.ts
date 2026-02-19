import type { WALRecord } from "./wal-record";
import { encodeRecord } from "./wal-record";
import { WALIndex } from "./wal-index";
import { WALSegment } from "./wal-segment";
import type { WALConfig } from "./wal-types";
import { toNumber } from "./wal-types";
import type { WALPayload } from "./wal-record";

export class WALWriter {
  private config: WALConfig;
  private index: WALIndex;
  private currentSegment?: WALSegment;
  private currentSequence: number = 0;
  private writeCount = 0;
  private segmentCreatedAt = 0;

  constructor(config: WALConfig, index: WALIndex) {
    this.config = config;
    this.index = index;
  }

  async initialize(): Promise<void> {
    await this.index.load();
    this.currentSequence = await this.getNextSequenceFromDisk();

    const active = this.index.getActiveSegment();
    if (active) {
      this.currentSegment = WALSegment.open(
        this.config.walDir,
        toNumber(active.startSequence),
      );
      this.segmentCreatedAt = active.createdAt;
    } else {
      await this.rotate();
    }
  }

  async append(payload: WALPayload): Promise<number> {
    if (!this.currentSegment) {
      throw new Error("WALWriter not initialized");
    }

    const record: WALRecord = {
      sequence: this.currentSequence,
      timestamp: Date.now(),
      payload,
    };

    const line = encodeRecord(record);
    this.currentSegment.append(line);
    this.writeCount++;

    if (
      this.config.fsyncEvery > 0 &&
      this.writeCount % this.config.fsyncEvery === 0
    ) {
      this.currentSegment.sync();
      this.currentSegment.openForWrite();
    }
    this.currentSequence++;

    await this.checkRotation();

    return record.sequence;
  }

  private async checkRotation(): Promise<void> {
    if (!this.currentSegment) {
      return;
    }

    const size = this.currentSegment.getSize();
    const age = Date.now() - this.segmentCreatedAt;
    const lines = this.currentSequence - this.currentSegment.startSequence;

    const needsRotation =
      size >= this.config.maxSegmentSize ||
      age >= this.config.maxSegmentAge ||
      Number(lines) >= this.config.maxSegmentLines;

    if (needsRotation) {
      await this.rotate();
    }
  }

  private async rotate(): Promise<void> {
    if (this.currentSegment) {
      this.currentSegment.sync();

      const active = this.index.getActiveSegment();
      if (active) {
        this.index.update(active.filename, { closedAt: Date.now() });
      }
    }
    const newSegment = WALSegment.create(
      this.config.walDir,
      this.currentSequence,
    );

    this.index.register({
      filename: newSegment.path.split("/").pop()!,
      startSequence: this.currentSequence,
      lineCount: 0,
      fileSize: 0,
      createdAt: Date.now(),
    });
    await this.index.save();

    this.currentSegment = newSegment;
    this.segmentCreatedAt = Date.now();
    this.writeCount = 0;
  }

  async close(): Promise<void> {
    if (this.currentSegment) {
      this.currentSegment.sync();
    }
    await this.index.save();
  }

  private async getNextSequenceFromDisk(): Promise<number> {
    let maxSequence = -1;
    const segments = this.index.getAllSegments();

    for (const meta of segments) {
      const segment = WALSegment.open(
        this.config.walDir,
        toNumber(meta.startSequence),
      );
      for await (const rawLine of segment.readLines(0)) {
        try {
          const parsed = JSON.parse(rawLine) as WALRecord;
          if (
            typeof parsed.sequence === "number" &&
            Number.isFinite(parsed.sequence)
          ) {
            maxSequence = Math.max(maxSequence, parsed.sequence);
          }
        } catch (err) {
          console.warn(
            `Skipping invalid WAL line while bootstrapping ${meta.filename}:`,
            err,
          );
        }
      }
    }

    return maxSequence + 1;
  }
}
