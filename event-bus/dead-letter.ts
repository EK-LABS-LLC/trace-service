import { mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WALRecord } from "./wal-record";

/**
 * A dead letter entry for a failed record.
 */
export interface DeadLetterEntry {
  /** Sequence number of the failed record */
  sequence: string;
  /** The original WAL record */
  originalRecord: WALRecord;
  /** Error message */
  error: string;
  /** Unix timestamp when the record failed */
  failedAt: number;
  /** Number of retry attempts */
  retries: number;
}

/**
 * Dead letter queue for failed WAL records.
 * Stores failed records as individual JSON files for manual inspection.
 */
export class DeadLetterQueue {
  private dlqDir: string;

  constructor(dlqDir: string) {
    this.dlqDir = dlqDir;
    mkdirSync(this.dlqDir, { recursive: true });
  }

  /**
   * Write a failed record to the DLQ.
   */
  async write(record: WALRecord, error: string, retries: number): Promise<void> {
    const entry: DeadLetterEntry = {
      sequence: record.sequence.toString(),
      originalRecord: record,
      error,
      failedAt: Date.now(),
      retries,
    };

    const filename = `${record.sequence.toString()}.dlq.json`;
    const filepath = join(this.dlqDir, filename);

    writeFileSync(filepath, JSON.stringify(entry, null, 2));
  }

  /**
   * List all dead letter entries.
   */
  list(): DeadLetterEntry[] {
    const entries: DeadLetterEntry[] = [];

    if (!require("node:fs").existsSync(this.dlqDir)) {
      return entries;
    }

    const files = readdirSync(this.dlqDir);
    for (const file of files) {
      if (!file.endsWith(".dlq.json")) {
        continue;
      }

      try {
        const filepath = join(this.dlqDir, file);
        const content = readFileSync(filepath, "utf-8");
        const entry = JSON.parse(content) as DeadLetterEntry;
        entries.push(entry);
      } catch (err) {
        console.warn(`Failed to read DLQ entry ${file}:`, err);
      }
    }

    return entries.sort((a, b) => a.sequence.localeCompare(b.sequence));
  }

  /**
   * Get count of dead letter entries.
   */
  count(): number {
    if (!require("node:fs").existsSync(this.dlqDir)) {
      return 0;
    }

    const files = readdirSync(this.dlqDir);
    return files.filter((f) => f.endsWith(".dlq.json")).length;
  }

  /**
   * Delete a dead letter entry by sequence number.
   */
  async delete(sequence: string): Promise<boolean> {
    const filename = `${sequence}.dlq.json`;
    const filepath = join(this.dlqDir, filename);

    try {
      const fs = require("node:fs");
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clear all dead letter entries.
   */
  async clear(): Promise<void> {
    const entries = this.list();
    for (const entry of entries) {
      await this.delete(entry.sequence);
    }
  }
}
