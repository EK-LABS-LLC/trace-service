import {
  mkdirSync,
  existsSync,
  statSync,
  openSync,
  closeSync,
  writeSync,
  readFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { formatSequence } from "./wal-types";

/**
 * A single WAL segment file.
 * Handles reading, writing, and truncation of NDJSON log files.
 */
export class WALSegment {
  readonly path: string;
  readonly startSequence: number;
  private fd?: number;

  constructor(walDir: string, startSequence: number) {
    this.startSequence = startSequence;
    this.path = join(walDir, "segments", `${formatSequence(startSequence)}.ndjson`);
  }

  /**
   * Create a new segment file.
   */
  static create(walDir: string, startSequence: number): WALSegment {
    const segment = new WALSegment(walDir, startSequence);
    const segmentsDir = join(walDir, "segments");

    mkdirSync(segmentsDir, { recursive: true });

    const fd = openSync(segment.path, "wx"); // Create exclusive
    require("node:fs").writeFileSync(segment.path, "", { flag: "a" });
    closeSync(fd);

    return segment;
  }

  /**
   * Open an existing segment for reading/writing.
   */
  static open(walDir: string, startSequence: number): WALSegment {
    return new WALSegment(walDir, startSequence);
  }

  /**
   * Open the file handle for writing.
   */
  openForWrite(): void {
    if (this.fd === undefined) {
      mkdirSync(dirname(this.path), { recursive: true });
      this.fd = openSync(this.path, "a");
    }
  }

  /**
   * Append a JSON line to the segment.
   */
  append(line: string): void {
    this.openForWrite();
    if (this.fd === undefined) {
      throw new Error("File descriptor not available");
    }

    const buffer = Buffer.from(line, "utf-8");
    writeSync(this.fd, buffer, 0, buffer.length, null);
  }

  /**
   * Get the current file size.
   */
  getSize(): number {
    try {
      return statSync(this.path).size;
    } catch {
      return 0;
    }
  }

  /**
   * Read all lines from the segment starting from a given line number.
   * Yields raw JSON strings.
   */
  async *readLines(fromLine: number = 0): AsyncGenerator<string> {
    if (!existsSync(this.path)) {
      return;
    }

    const content = readFileSync(this.path, "utf-8");
    const lines = content.split("\n");

    // Filter out empty lines (trailing newline)
    for (let i = fromLine; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.length > 0) {
        yield line;
      }
    }
  }

  /**
   * Truncate the file at a specific line number.
   * Used for corruption recovery.
   */
  truncateAtLine(lineNumber: number): void {
    if (!existsSync(this.path)) {
      return;
    }

    const content = readFileSync(this.path, "utf-8");
    const lines = content.split("\n");

    if (lineNumber >= lines.length) {
      return; // Nothing to truncate
    }

    // Keep only lines up to lineNumber
    const newContent = lines.slice(0, lineNumber).join("\n");
    if (newContent.length > 0) {
      // Ensure trailing newline
      const withNewline = newContent + "\n";
      const fd = openSync(this.path, "w");
      writeSync(fd, Buffer.from(withNewline, "utf-8"));
      closeSync(fd);
    } else {
      // Empty file
      const fd = openSync(this.path, "w");
      closeSync(fd);
    }
  }

  /**
   * Sync and close the file handle.
   */
  sync(): void {
    if (this.fd !== undefined) {
      closeSync(this.fd);
      this.fd = undefined;
    }
  }

  /**
   * Delete the segment file.
   */
  delete(): void {
    try {
      if (existsSync(this.path)) {
        const fs = require("node:fs");
        fs.unlinkSync(this.path);
      }
    } catch (err) {
      console.warn(`Failed to delete segment ${this.path}:`, err);
    }
  }
}
