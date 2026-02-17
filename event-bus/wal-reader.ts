import type { WALRecord } from "./wal-record";
import { decodeRecord } from "./wal-record";
import { WALIndex } from "./wal-index";
import { WALSegment } from "./wal-segment";
import type { WALConfig } from "./wal-types";
import { toNumber } from "./wal-types";
import type { WALCheckpoint } from "./checkpoint";

/**
 * WAL reader handles reading records from the log.
 * Starts from checkpoint and handles segment boundaries.
 */
export class WALReader {
  private config: WALConfig;
  private checkpoint: WALCheckpoint;
  private index: WALIndex;
  private lastLoggedState?: { nextSequence: number; segmentsLength: number };

  constructor(
    config: WALConfig,
    checkpoint: WALCheckpoint,
    index: WALIndex
  ) {
    this.config = config;
    this.checkpoint = checkpoint;
    this.index = index;
  }

  /**
   * Read records from the checkpoint forward.
   * Yields WALRecord objects.
   */
  async *read(): AsyncGenerator<WALRecord> {
    // Re-scan segments each time to pick up new data
    await this.index.scan();
    await this.checkpoint.load();

    const nextSequence = this.checkpoint.getNextSequence();
    const segments = this.index.getAllSegments();

    const stateChanged =
      !this.lastLoggedState ||
      this.lastLoggedState.nextSequence !== nextSequence ||
      this.lastLoggedState.segmentsLength !== segments.length;
    if (stateChanged) {
      console.log(`[WAL reader] nextSequence=${nextSequence}, segments.length=${segments.length}`);
      this.lastLoggedState = { nextSequence, segmentsLength: segments.length };
    }

    let lastSeenSequence = Number.NEGATIVE_INFINITY;

    // Read all segments in sorted order and gate by record.sequence.
    for (let i = 0; i < segments.length; i++) {
      const meta = segments[i]!;
      const segment = WALSegment.open(this.config.walDir, toNumber(meta.startSequence));

      let lineIndex = 0;
      const fromLine = 0;
      for await (const rawLine of segment.readLines(fromLine)) {
        try {
          const record = decodeRecord(rawLine);

          if (record.sequence <= lastSeenSequence) {
            console.error(
              `WAL out-of-order sequence in ${meta.filename}: sequence=${record.sequence}, lastSeen=${lastSeenSequence}`
            );
            segment.truncateAtLine(fromLine + lineIndex);
            this.index.update(meta.filename, {
              lineCount: fromLine + lineIndex,
            });
            await this.index.save();
            return;
          }

          lastSeenSequence = record.sequence;

          if (record.sequence < nextSequence) {
            lineIndex++;
            continue;
          }

          yield record;
        } catch (err) {
          console.error(`Failed to decode WAL record in ${meta.filename} at line ${fromLine + lineIndex}:`, err);
          // Truncate at this point
          segment.truncateAtLine(fromLine + lineIndex);
          // Update index
          this.index.update(meta.filename, {
            lineCount: fromLine + lineIndex,
          });
          await this.index.save();
          return; // Stop reading
        }

        lineIndex++;
      }
    }
  }

  /**
   * Mark the next sequence to process (update checkpoint).
   */
  async markNextSequence(nextSequence: number): Promise<void> {
    await this.checkpoint.save(nextSequence);
  }
}
