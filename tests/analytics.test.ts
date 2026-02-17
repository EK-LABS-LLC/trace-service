import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  authFetch,
  createTestProject,
  createTestTraces,
  cleanupTestData,
} from "./setup";
import type { CostDataPoint } from "../db/analytics";

describe("Analytics Endpoint", () => {
  let testProject: { id: string; apiKey: string };

  beforeAll(async () => {
    console.log("[analytics.test] Setting up test project...");
    testProject = await createTestProject("Analytics Test Project");
    console.log(`[analytics.test] Created project: ${testProject.id}`);
    await createTestTraces(testProject.id, 20);
    console.log("[analytics.test] Created 20 test traces");
  });

  afterAll(async () => {
    console.log("[analytics.test] Cleaning up test data...");
    await cleanupTestData();
  });

  describe("GET /v1/analytics", () => {
    const dateFrom = "2020-01-01T00:00:00Z";
    const dateTo = "2030-12-31T23:59:59Z";

    test("returns analytics data for project", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}`,
        testProject.apiKey,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("totalCost");
      expect(data).toHaveProperty("totalRequests");
      expect(data).toHaveProperty("totalSessions");
      expect(data).toHaveProperty("totalTokens");
      expect(data).toHaveProperty("avgLatency");
      expect(data).toHaveProperty("errorRate");
      expect(data).toHaveProperty("costOverTime");
      expect(data).toHaveProperty("computed");
    });

    test("totalRequests matches trace count", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as { totalRequests: number };

      expect((data as { totalRequests: number }).totalRequests).toBe(20);
    });

    test("returns computed metrics", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as {
        computed: {
          costPerRequest: number;
          tokensPerRequest: number;
          costPer1kTokens: number;
          tracesPerSession: number;
          avgInputTokens: number;
          avgOutputTokens: number;
        };
      };

      expect(data.computed).toHaveProperty("costPerRequest");
      expect(data.computed).toHaveProperty("tokensPerRequest");
      expect(data.computed).toHaveProperty("costPer1kTokens");
      expect(data.computed).toHaveProperty("tracesPerSession");
      expect(data.computed).toHaveProperty("avgInputTokens");
      expect(data.computed).toHaveProperty("avgOutputTokens");
    });

    test("returns token breakdown", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as {
        totalTokens: { input: number; output: number; total: number };
      };

      expect(
        (
          data as {
            totalTokens: { input: number; output: number; total: number };
          }
        ).totalTokens,
      ).toHaveProperty("input");
      expect(data.totalTokens).toHaveProperty("output");
      expect(data.totalTokens).toHaveProperty("total");
      expect(data.totalTokens.total).toBe(
        data.totalTokens.input + data.totalTokens.output,
      );
    });

    test("calculates error rate correctly", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}`,
        testProject.apiKey,
      );
      const data = (await response.json()) as { errorRate: number };

      // We created 20 traces, 1 is error (first one in createTestTraces)
      expect(data.errorRate).toBe(5); // 1/20 = 5%
    });

    test("requires date_from parameter", async () => {
      const response = await authFetch(
        `/v1/analytics?date_to=${dateTo}`,
        testProject.apiKey,
      );

      expect(response.status).toBe(400);
    });

    test("requires date_to parameter", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}`,
        testProject.apiKey,
      );

      expect(response.status).toBe(400);
    });

    test("requires ISO datetime format", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=2024-01-01&date_to=2024-12-31`,
        testProject.apiKey,
      );

      expect(response.status).toBe(400);
    });

    test("supports group_by parameter", async () => {
      const response = await authFetch(
        `/v1/analytics?date_from=${dateFrom}&date_to=${dateTo}&group_by=day`,
        testProject.apiKey,
      );
      const data = (await response.json()) as { costOverTime: CostDataPoint[] };

      expect(response.status).toBe(200);
      expect(data.costOverTime).toBeInstanceOf(Array);
    });
  });
});
