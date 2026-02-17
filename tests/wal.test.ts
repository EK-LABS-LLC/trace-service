import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  BASE_URL,
  authFetch,
  createTestProject,
  cleanupTestData,
} from "./setup";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface WALRecord {
  sequence: number;
  timestamp: number;
  payload: {
    projectId: string;
    traces: Array<{
      trace_id: string;
      timestamp: string;
      provider: string;
      model_requested: string;
      request_body: Record<string, unknown>;
      status: string;
      latency_ms: number;
    }>;
  };
}

interface Trace {
  traceId: string;
  provider: string;
  modelRequested: string;
  status: string;
  [key: string]: unknown;
}

interface TracesResponse {
  traces: Trace[];
  total: number;
}

/**
 * WAL File Helpers - only for reading and verifying storage
 */
function getWalDir(): string {
  return join(process.cwd(), ".data", "wal");
}

function getSegmentsDir(): string {
  return join(getWalDir(), "segments");
}

/**
 * Read and parse all records from a WAL segment file
 */
function readSegmentFile(filename: string): WALRecord[] {
  const segmentsDir = getSegmentsDir();
  const filePath = join(segmentsDir, filename);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.length > 0);

  return lines.map((line) => JSON.parse(line) as WALRecord);
}

/**
 * Get all WAL segment files sorted by name
 */
function getSegmentFiles(): string[] {
  const segmentsDir = getSegmentsDir();
  if (!existsSync(segmentsDir)) {
    return [];
  }

  const files = readdirSync(segmentsDir);
  return files.filter((file) => file.endsWith(".ndjson")).sort();
}

/**
 * Get all WAL records across all segments
 */
function getAllWALRecords(): WALRecord[] {
  const segmentFiles = getSegmentFiles();
  const allRecords: WALRecord[] = [];

  for (const file of segmentFiles) {
    allRecords.push(...readSegmentFile(file));
  }

  return allRecords;
}

/**
 * Find a WAL record by trace ID
 */
function findWALRecordByTraceId(traceId: string): WALRecord | null {
  const allRecords = getAllWALRecords();

  for (const record of allRecords) {
    for (const trace of record.payload.traces) {
      if (trace.trace_id === traceId) {
        return record;
      }
    }
  }

  return null;
}

/**
 * Get checkpoint data
 */
function getCheckpointData(): {
  nextSequence: string;
  processedAt: number;
} | null {
  const checkpointPath = join(getWalDir(), "wal.checkpoint");

  if (!existsSync(checkpointPath)) {
    return null;
  }

  const content = readFileSync(checkpointPath, "utf-8");
  return JSON.parse(content);
}

describe("WAL Integration Tests", () => {
  let testProject: { id: string; apiKey: string };

  beforeAll(async () => {
    console.log("[wal.test] Setting up test project...");
    testProject = await createTestProject("WAL Integration Test");
    console.log(`[wal.test] Created project: ${testProject.id}`);
  });

  afterAll(async () => {
    console.log("[wal.test] Cleaning up test data...");
    await cleanupTestData();
  });

  describe("WAL File Structure", () => {
    test("writes valid NDJSON to segment files", async () => {
      const traceId = crypto.randomUUID();
      const traces = [
        {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o-mini",
          latency_ms: 100,
          status: "success" as const,
          request_body: { messages: [] },
        },
      ];

      const response = await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traces),
      });

      expect(response.status).toBe(202);

      // Wait a bit for the write to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the trace was written to WAL
      const walRecord = findWALRecordByTraceId(traceId);
      expect(walRecord).toBeDefined();
      expect(walRecord?.payload.projectId).toBe(testProject.id);
    });

    test("segment files use zero-padded 16-digit naming", async () => {
      const segmentFiles = getSegmentFiles();
      expect(segmentFiles.length).toBeGreaterThan(0);

      const filename = segmentFiles[0]!;
      // Match pattern: 0000000000000001.ndjson
      expect(filename).toMatch(/^\d{16}\.ndjson$/);
    });

    test("each record has incrementing sequence numbers", () => {
      const allRecords = getAllWALRecords();
      expect(allRecords.length).toBeGreaterThan(0);

      // Check sequences are strictly increasing
      for (let i = 1; i < allRecords.length; i++) {
        expect(allRecords[i]!.sequence).toBeGreaterThan(
          allRecords[i - 1]!.sequence,
        );
      }
    });
  });

  describe("Async Endpoint → WAL → Database Flow", () => {
    test("trace flows through async endpoint to database", async () => {
      const traceId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const traces = [
        {
          trace_id: traceId,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          provider: "anthropic" as const,
          model_requested: "claude-3-opus",
          latency_ms: 250,
          status: "success" as const,
          request_body: { messages: [] },
          input_tokens: 150,
          output_tokens: 300,
        },
      ];

      // Send to async endpoint
      const asyncResponse = await authFetch(
        "/v1/traces/async",
        testProject.apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(traces),
        },
      );

      expect(asyncResponse.status).toBe(202);

      // Verify WAL was written
      await new Promise((resolve) => setTimeout(resolve, 100));
      const walRecord = findWALRecordByTraceId(traceId);
      expect(walRecord).toBeDefined();

      // Wait for WAL processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify trace is in database via API
      const queryResponse = await authFetch(
        `/v1/traces/${traceId}`,
        testProject.apiKey,
      );
      expect(queryResponse.status).toBe(200);

      const trace = (await queryResponse.json()) as Trace;
      expect(trace.traceId).toBe(traceId);
      expect(trace.provider).toBe("anthropic");
      expect(trace.modelRequested).toBe("claude-3-opus");
    });

    test("batch traces all processed and stored", async () => {
      const batchCount = 10;
      const traceIds = Array.from({ length: batchCount }, () =>
        crypto.randomUUID(),
      );

      const traces = traceIds.map((traceId) => ({
        trace_id: traceId,
        timestamp: new Date().toISOString(),
        provider: "openrouter" as const,
        model_requested: "mistral-large",
        latency_ms: 300,
        status: "success" as const,
        request_body: { messages: [] },
      }));

      // Send all traces in one request
      const batchResponse = await authFetch(
        "/v1/traces/async",
        testProject.apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(traces),
        },
      );

      expect(batchResponse.status).toBe(202);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify all traces are in database
      const queryResponse = await authFetch(
        `/v1/traces?limit=100`,
        testProject.apiKey,
      );
      const queryData = (await queryResponse.json()) as TracesResponse;

      const foundIds = queryData.traces.map((t) => t.traceId);
      for (const traceId of traceIds) {
        expect(foundIds).toContain(traceId);
      }
    });

    test("traces are queryable by session_id", async () => {
      const sessionId = crypto.randomUUID();

      const traces = [
        {
          trace_id: crypto.randomUUID(),
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o",
          latency_ms: 100,
          status: "success" as const,
          request_body: { messages: [] },
        },
        {
          trace_id: crypto.randomUUID(),
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o",
          latency_ms: 120,
          status: "success" as const,
          request_body: { messages: [] },
        },
      ];

      // Send both traces in one request
      await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traces),
      });

      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Query by session_id
      const sessionResponse = await authFetch(
        `/v1/traces?session_id=${sessionId}`,
        testProject.apiKey,
      );
      const sessionData = (await sessionResponse.json()) as TracesResponse;

      expect(sessionData.traces.length).toBeGreaterThanOrEqual(2);
      expect(
        sessionData.traces.every(
          (t) => (t as { sessionId?: string }).sessionId === sessionId,
        ),
      ).toBe(true);
    });

    test("error status traces are stored correctly", async () => {
      const traceId = crypto.randomUUID();
      const traces = [
        {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o",
          latency_ms: 5000,
          status: "error" as const,
          request_body: { messages: [] },
          error: {
            name: "APIError",
            message: "Rate limit exceeded",
          },
        },
      ];

      await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traces),
      });

      await new Promise((resolve) => setTimeout(resolve, 800));

      const response = await authFetch(
        `/v1/traces/${traceId}`,
        testProject.apiKey,
      );
      expect(response.status).toBe(200);

      const trace = (await response.json()) as Trace;
      expect(trace.status).toBe("error");
      expect(trace.latencyMs).toBe(5000);
    });
  });

  describe("WAL Persistence", () => {
    test("multiple async requests result in multiple WAL records", async () => {
      const initialRecords = getAllWALRecords().length;

      const traces = Array.from({ length: 3 }, () => ({
        trace_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        provider: "openai" as const,
        model_requested: "gpt-4o-mini",
        latency_ms: 100,
        status: "success" as const,
        request_body: { messages: [] },
      }));

      await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traces),
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalRecords = getAllWALRecords().length;
      expect(finalRecords).toBeGreaterThan(initialRecords);
    });
  });

  describe("Checkpoint and Recovery", () => {
    test("checkpoint file is created after processing", async () => {
      const traceId = crypto.randomUUID();
      const traces = [
        {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o-mini",
          latency_ms: 100,
          status: "success" as const,
          request_body: { messages: [] },
        },
      ];

      await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traces),
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check checkpoint file exists
      const checkpoint = getCheckpointData();
      expect(checkpoint).toBeDefined();
      expect(checkpoint).toHaveProperty("nextSequence");
      expect(checkpoint).not.toHaveProperty("lastProcessedSequence");
      expect(checkpoint).toHaveProperty("processedAt");
    });
  });

  describe("Error Handling", () => {
    test("rejects trace with missing required field", async () => {
      const invalidTrace = [
        {
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o-mini",
          latency_ms: 100,
          status: "success" as const,
          // Missing trace_id
          request_body: { messages: [] },
        },
      ];

      const response = await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidTrace),
      });

      expect(response.status).toBe(400);
    });

    test("rejects batch exceeding 100 traces", async () => {
      const largeBatch = Array.from({ length: 101 }, () => ({
        trace_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        provider: "openai" as const,
        model_requested: "gpt-4o-mini",
        latency_ms: 100,
        status: "success" as const,
        request_body: { messages: [] },
      }));

      const response = await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(largeBatch),
      });

      expect(response.status).toBe(400);
    });

    test("rejects trace with invalid provider enum", async () => {
      const invalidTrace = [
        {
          trace_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          provider: "invalid-provider" as const,
          model_requested: "gpt-4o-mini",
          latency_ms: 100,
          status: "success" as const,
          request_body: { messages: [] },
        },
      ];

      const response = await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidTrace),
      });

      expect(response.status).toBe(400);
    });

    test("rejects trace with negative latency", async () => {
      const invalidTrace = [
        {
          trace_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          provider: "openai" as const,
          model_requested: "gpt-4o-mini",
          latency_ms: -100,
          status: "success" as const,
          request_body: { messages: [] },
        },
      ];

      const response = await authFetch("/v1/traces/async", testProject.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidTrace),
      });

      expect(response.status).toBe(400);
    });
  });
});
