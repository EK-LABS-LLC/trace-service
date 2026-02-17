import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  authFetch,
  createTestProject,
  createTestTraces,
  createTestSpans,
  cleanupTestData,
} from "./setup";

interface Trace {
  timestamp: string;
}

describe("Sessions Endpoint", () => {
  let testProject: { id: string; apiKey: string };
  let sessionId: string;

  beforeAll(async () => {
    console.log("[sessions.test] Setting up test project...");
    testProject = await createTestProject("Sessions Test Project");
    console.log(`[sessions.test] Created project: ${testProject.id}`);

    sessionId = crypto.randomUUID();
    console.log(`[sessions.test] Created session: ${sessionId}`);

    // Create traces for that session
    await createTestTraces(testProject.id, 10, sessionId);
    console.log("[sessions.test] Created 10 test traces");
    await createTestSpans(testProject.id, 12, sessionId);
    console.log("[sessions.test] Created 12 test spans");
  });

  afterAll(async () => {
    console.log("[sessions.test] Cleaning up test data...");
    await cleanupTestData();
  });

  describe("GET /v1/sessions/:id", () => {
    test("returns all traces for a session", async () => {
      const response = await authFetch(
        `/v1/sessions/${sessionId}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as {
        sessionId: string;
        traces: Trace[];
      };

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("sessionId");
      expect(data).toHaveProperty("traces");
      expect(data.sessionId).toBe(sessionId);
      expect(data.traces.length).toBe(10);
    });

    test("traces are ordered by timestamp", async () => {
      const response = await authFetch(
        `/v1/sessions/${sessionId}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as { traces: Trace[] };

      const timestamps = data.traces.map((t: Trace) =>
        new Date(t.timestamp).getTime(),
      );
      const sorted = [...timestamps].sort((a, b) => a - b);

      expect(timestamps).toEqual(sorted);
    });

    test("returns 404 for non-existent session", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await authFetch(
        `/v1/sessions/${fakeId}`,
        testProject.apiKey,
      );

      expect(response.status).toBe(404);
    });

    test("returns 401 without auth", async () => {
      const response = await fetch(
        `http://localhost:3000/v1/sessions/${sessionId}`,
      );

      expect(response.status).toBe(401);
    });

    test("cannot access another project's session", async () => {
      // Create another project
      const otherProject = await createTestProject("Other Project");

      // Try to access first project's session with second project's key
      const response = await authFetch(
        `/v1/sessions/${sessionId}`,
        otherProject.apiKey,
      );

      // Should return 404 (not found for this project)
      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/sessions/:id/spans", () => {
    test("returns all spans for a session", async () => {
      const response = await authFetch(
        `/v1/sessions/${sessionId}/spans`,
        testProject.apiKey,
      );
      const data = (await response.json()) as {
        sessionId: string;
        spans: Array<{ timestamp: string }>;
      };

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe(sessionId);
      expect(data.spans.length).toBe(12);
    });

    test("spans are ordered by timestamp", async () => {
      const response = await authFetch(
        `/v1/sessions/${sessionId}/spans`,
        testProject.apiKey,
      );
      const data = (await response.json()) as {
        spans: Array<{ timestamp: string }>;
      };

      const timestamps = data.spans.map((s) => new Date(s.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sorted);
    });

    test("returns 404 for non-existent session span list", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await authFetch(
        `/v1/sessions/${fakeId}/spans`,
        testProject.apiKey,
      );
      expect(response.status).toBe(404);
    });
  });
});
