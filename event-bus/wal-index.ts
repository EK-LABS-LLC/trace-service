import {
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import type { SegmentMetadata, WALConfig } from "./wal-types";
import { parseSequence, toNumber } from "./wal-types";

/**
 * WAL index manages segment metadata.
 * Tracks which segments exist and their properties.
 */
export class WALIndex {
  private segments: Map<string, SegmentMetadata> = new Map();
  private indexPath: string;

  constructor(walDir: string) {
    this.indexPath = join(walDir, "wal-index.json");
  }

  /**
   * Load index from disk or scan segments directory.
   * Always scans to ensure we have the latest state.
   */
  async load(): Promise<void> {
    // Always scan to get the actual state from disk
    // The index file is only used as a hint, but we verify by scanning
    await this.scan();
  }

  /**
   * Scan the segments directory to rebuild index.
   */
  async scan(): Promise<void> {
    this.segments.clear();

    const segmentsDir = join(dirname(this.indexPath), "segments");
    if (!existsSync(segmentsDir)) {
      return;
    }

    const files = readdirSync(segmentsDir);
    for (const file of files) {
      if (!file.endsWith(".ndjson")) {
        continue;
      }

      const seq = parseSequence(file);
      if (seq === null) {
        continue;
      }

      const filePath = join(segmentsDir, file);
      const stats = statSync(filePath);

      // Count lines
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.length > 0);

      const meta: SegmentMetadata = {
        filename: file,
        startSequence: seq,
        lineCount: lines.length,
        fileSize: stats.size,
        createdAt: stats.mtimeMs,
      };

      this.segments.set(file, meta);
    }
  }

  /**
   * Save index to disk atomically.
   */
  async save(): Promise<void> {
    const tmpPath = this.indexPath + ".tmp";
    const data = {
      segments: Array.from(this.segments.values()).map((s) => ({
        ...s,
        startSequence: toNumber(s.startSequence).toString(),
      })),
    };

    mkdirSync(dirname(this.indexPath), { recursive: true });
    writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    renameSync(tmpPath, this.indexPath);
  }

  /**
   * Register a new segment in the index.
   */
  register(metadata: SegmentMetadata): void {
    this.segments.set(metadata.filename, metadata);
  }

  /**
   * Update metadata for a segment.
   */
  update(filename: string, updates: Partial<SegmentMetadata>): void {
    const existing = this.segments.get(filename);
    if (existing) {
      this.segments.set(filename, { ...existing, ...updates });
    }
  }

  /**
   * Get all segments sorted by start sequence.
   */
  getAllSegments(): SegmentMetadata[] {
    return Array.from(this.segments.values()).sort((a, b) => {
      const aSeq = toNumber(a.startSequence);
      const bSeq = toNumber(b.startSequence);
      return aSeq - bSeq;
    });
  }

  /**
   * Get the active (unclosed) segment.
   */
  getActiveSegment(): SegmentMetadata | null {
    for (const meta of this.segments.values()) {
      if (meta.closedAt === undefined) {
        return meta;
      }
    }
    return null;
  }

  /**
   * Get segments that are ready for cleanup.
   */
  getCleanupCandidates(config: WALConfig): SegmentMetadata[] {
    const all = this.getAllSegments();
    const closed = all.filter((s) => s.closedAt !== undefined);

    if (closed.length === 0) {
      return [];
    }

    // Keep the last maxSegments
    const toKeep = new Set<number>();
    const keepCount = Math.min(config.maxSegments, closed.length);
    for (let i = closed.length - keepCount; i < closed.length; i++) {
      toKeep.add(toNumber(closed[i]!.startSequence));
    }

    const now = Date.now();
    const candidates: SegmentMetadata[] = [];

    for (const meta of closed) {
      const seq = toNumber(meta.startSequence);
      if (toKeep.has(seq)) {
        continue;
      }

      const age = now - meta.createdAt;
      if (age > config.maxRetentionAge) {
        candidates.push(meta);
      }
    }

    return candidates;
  }

  /**
   * Find the segment containing a given sequence number.
   */
  findSegmentForSequence(sequence: number): SegmentMetadata | null {
    for (const meta of this.segments.values()) {
      const startSeq = toNumber(meta.startSequence);
      const endSequence = startSeq + meta.lineCount;
      if (sequence >= startSeq && sequence < endSequence) {
        return meta;
      }
    }
    return null;
  }

  /**
   * Get the highest sequence number across all segments.
   */
  getMaxSequence(): number {
    let max = 0;
    for (const meta of this.segments.values()) {
      const startSeq = toNumber(meta.startSequence);
      const endSequence = startSeq + meta.lineCount;
      if (endSequence > max) {
        max = endSequence;
      }
    }
    return max;
  }
}
