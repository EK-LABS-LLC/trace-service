import {
  mkdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * Checkpoint data persisted to disk.
 */
export interface CheckpointData {
  /** The next sequence number to process */
  nextSequence: string;
  /** Unix timestamp when checkpoint was saved */
  processedAt: number;
}

const CHECKPOINT_FILE = "wal.checkpoint";
const CHECKPOINT_TMP = "wal.checkpoint.tmp";

/**
 * WAL checkpoint manager for crash recovery.
 * Uses atomic write-rename pattern for durability.
 */
export class WALCheckpoint {
  private checkpointPath: string;
  private data: CheckpointData;

  constructor(walDir: string) {
    this.checkpointPath = `${walDir}/${CHECKPOINT_FILE}`;
    this.data = this.defaultCheckpoint();
  }

  private defaultCheckpoint(): CheckpointData {
    return {
      nextSequence: "0",
      processedAt: Date.now(),
    };
  }

  /**
   * Load checkpoint from disk.
   * If missing or corrupt, returns default (start from 0).
   */
  async load(): Promise<void> {
    if (!existsSync(this.checkpointPath)) {
      this.data = this.defaultCheckpoint();
      return;
    }

    try {
      const content = readFileSync(this.checkpointPath, "utf-8");
      this.data = JSON.parse(content) as CheckpointData;
    } catch (err) {
      console.warn("Failed to load WAL checkpoint, starting from 0:", err);
      this.data = this.defaultCheckpoint();
    }
  }

  /**
   * Save checkpoint atomically.
   * Uses write-to-tmp + rename pattern for crash safety.
   */
  async save(nextSequence: number): Promise<void> {
    const newData: CheckpointData = {
      nextSequence: nextSequence.toString(),
      processedAt: Date.now(),
    };

    const tmpPath = `${dirname(this.checkpointPath)}/${CHECKPOINT_TMP}`;
    const json = JSON.stringify(newData, null, 2);

    mkdirSync(dirname(this.checkpointPath), { recursive: true });
    writeFileSync(tmpPath, json, { mode: 0o644 });

    renameSync(tmpPath, this.checkpointPath);

    this.data = newData;
  }

  /** Get the next sequence number as number */
  getNextSequence(): number {
    return Number.parseInt(this.data.nextSequence, 10);
  }

  /** Get the raw checkpoint data */
  getData(): CheckpointData {
    return this.data;
  }
}
