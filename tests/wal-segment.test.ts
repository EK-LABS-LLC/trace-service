import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WALIndex } from "../event-bus/wal-index";
import { WALSegment } from "../event-bus/wal-segment";
import { WALWriter } from "../event-bus/wal-writer";

const testDirs: string[] = [];

function createSegment(): WALSegment {
  const walDir = mkdtempSync(join(tmpdir(), "trace-service-wal-segment-"));
  testDirs.push(walDir);

  const segment = WALSegment.create(walDir, 0);
  segment.append('{"sequence":0}\n');
  return segment;
}

afterEach(() => {
  for (const testDir of testDirs.splice(0)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("WALSegment.sync", () => {
  test("fsyncs the active descriptor before closing it", () => {
    const segment = createSegment();
    const calls: string[] = [];
    const originalFsyncSync = fs.fsyncSync;
    const originalCloseSync = fs.closeSync;
    const fsyncSpy = spyOn(fs, "fsyncSync").mockImplementation((fd) => {
      calls.push("fsync");
      originalFsyncSync(fd);
    });
    const closeSpy = spyOn(fs, "closeSync").mockImplementation((fd) => {
      calls.push("close");
      originalCloseSync(fd);
    });

    try {
      segment.sync();
      expect(calls).toEqual(["fsync", "close"]);
    } finally {
      fsyncSpy.mockRestore();
      closeSpy.mockRestore();
    }
  });

  test("propagates fsync failures without closing the descriptor", () => {
    const segment = createSegment();
    const syncError = new Error("fsync failed");
    const fsyncSpy = spyOn(fs, "fsyncSync").mockImplementation(() => {
      throw syncError;
    });
    const closeSpy = spyOn(fs, "closeSync");

    try {
      expect(() => segment.sync()).toThrow(syncError);
      expect(fsyncSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).not.toHaveBeenCalled();
    } finally {
      fsyncSpy.mockRestore();
      closeSpy.mockRestore();
      segment.sync();
    }
  });
});

describe("WALWriter.append", () => {
  test("rejects when the configured per-write fsync fails", async () => {
    const walDir = mkdtempSync(join(tmpdir(), "trace-service-wal-writer-"));
    testDirs.push(walDir);

    const writer = new WALWriter(
      {
        walDir,
        maxSegmentSize: 100 * 1024 * 1024,
        maxSegmentAge: 24 * 60 * 60 * 1000,
        maxSegmentLines: 100000,
        fsyncEvery: 1,
        maxSegments: 10,
        maxRetentionAge: 7 * 24 * 60 * 60 * 1000,
      },
      new WALIndex(walDir),
    );
    await writer.initialize();

    const syncError = new Error("fsync failed");
    const fsyncSpy = spyOn(fs, "fsyncSync").mockImplementation(() => {
      throw syncError;
    });

    try {
      await expect(
        writer.append({ projectId: "project", spans: [] }),
      ).rejects.toThrow(syncError);
      expect(fsyncSpy).toHaveBeenCalledTimes(1);
    } finally {
      fsyncSpy.mockRestore();
      await writer.close();
    }
  });
});
