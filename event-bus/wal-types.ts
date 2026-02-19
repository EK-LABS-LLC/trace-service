/**
 * Shared types and utilities for the WAL implementation.
 *
 * ## Segment File Naming Convention
 *
 * Segment files are named with a zero-padded 16-digit sequence number:
 *
 *   0000000000000001.ndjson  // First segment (starts at sequence 0)
 *   0000000000000002.ndjson  // Second segment (starts at sequence 10,000)
 *   0000000000000003.ndjson  // Third segment (starts at sequence 20,000)
 *
 * The sequence number represents the FIRST record's sequence in that segment.
 *
 * Example: If segment "0000000000000002.ndjson" has 5,000 lines, it contains:
 * - Sequences 10,000 through 14,999
 * - Next segment would be "000000000000015.ndjson" (starting at 15,000)
 *
 * ## parseSequence Function
 *
 * Extracts the sequence number from a segment filename:
 *
 *   parseSequence("0000000000000001.ndjson") // Returns: 1
 *   parseSequence("0000000000000420.ndjson") // Returns: 420
 *   parseSequence("invalid.ndjson")          // Returns: null
 *   parseSequence("0000000000000001.txt")    // Returns: null (wrong extension)
 */

/**
 * Metadata about a WAL segment file.
 */
export interface SegmentMetadata {
  filename: string;
  /** Sequence number of the first record in this segment (stored as string for JSON serialization) */
  startSequence: number | string;
  lineCount: number;
  fileSize: number;
  createdAt: number;
  closedAt?: number;
}

/**
 * Configuration for WAL behavior.
 */
export interface WALConfig {
  walDir: string;
  /** Maximum segment size in bytes before rotation */
  maxSegmentSize: number;
  /** Maximum segment age in ms before rotation */
  maxSegmentAge: number;
  maxSegmentLines: number;
  /** fsync every N writes (0 = fsync on close only) */
  fsyncEvery: number;
  /** Maximum number of segments to retain */
  maxSegments: number;
  maxRetentionAge: number;
}

/**
 * Format a sequence number as a zero-padded 16-digit string.
 */
export function formatSequence(seq: number): string {
  return seq.toString().padStart(16, "0");
}

/**
 * Parse a sequence number from a filename.
 * "0000000000000001.ndjson" → 1
 */
export function parseSequence(filename: string): number | null {
  // Remove .ndjson extension to get the numeric part
  const baseName = filename.replace(/\.ndjson$/, "");

  // Verify it's all digits (no invalid characters)
  if (/^\d+$/.test(baseName)) {
    const parsed = Number.parseInt(baseName, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Helper to convert string/number to number.
 */
export function toNumber(value: number | string): number {
  return typeof value === "string" ? Number.parseInt(value, 10) : value;
}
