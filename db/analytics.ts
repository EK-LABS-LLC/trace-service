import { eq, and, gte, lte, sql, sum, avg, count, isNotNull, desc } from "drizzle-orm";
import type { Database } from "./index";
import { traces } from "./schema";
import type { GroupBy } from "../shared/validation";

/**
 * Date range filter for analytics queries.
 */
export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Cost over time data point.
 */
export interface CostDataPoint {
  period: string;
  costCents: number;
}

/**
 * Cost by provider data point.
 */
export interface CostByProvider {
  provider: string;
  costCents: number;
  requests: number;
}

/**
 * Stats by model data point.
 */
export interface StatsByModel {
  provider: string;
  model: string;
  requests: number;
  costCents: number;
  avgLatency: number;
  totalTokens: number;
  errorRate: number;
}

/**
 * Latency distribution bucket.
 */
export interface LatencyBucket {
  bucket: string;
  count: number;
}

/**
 * Latency percentiles.
 */
export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Cost over time by provider data point.
 */
export interface CostOverTimeByProvider {
  period: string;
  provider: string;
  costCents: number;
}

/**
 * Build common date range conditions for analytics queries.
 */
function buildDateConditions(projectId: string, dateRange: DateRange) {
  return and(
    eq(traces.projectId, projectId),
    gte(traces.timestamp, dateRange.dateFrom),
    lte(traces.timestamp, dateRange.dateTo)
  );
}

/**
 * Get total cost in cents for a project within a date range.
 */
export async function getTotalCost(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const result = await db
    .select({ total: sum(traces.costCents) })
    .from(traces)
    .where(buildDateConditions(projectId, dateRange));

  return Number(result[0]?.total ?? 0);
}

/**
 * Get total tokens (input + output) for a project within a date range.
 */
export async function getTotalTokens(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number }> {
  const result = await db
    .select({
      inputTokens: sum(traces.inputTokens),
      outputTokens: sum(traces.outputTokens),
    })
    .from(traces)
    .where(buildDateConditions(projectId, dateRange));

  const inputTokens = Number(result[0]?.inputTokens ?? 0);
  const outputTokens = Number(result[0]?.outputTokens ?? 0);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Get average latency in milliseconds for a project within a date range.
 */
export async function getAvgLatency(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const result = await db
    .select({ avg: avg(traces.latencyMs) })
    .from(traces)
    .where(buildDateConditions(projectId, dateRange));

  return Number(result[0]?.avg ?? 0);
}

/**
 * Get error rate (percentage of traces with error status) for a project within a date range.
 */
export async function getErrorRate(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const conditions = buildDateConditions(projectId, dateRange);

  const [totalResult, errorResult] = await Promise.all([
    db.select({ count: count() }).from(traces).where(conditions),
    db
      .select({ count: count() })
      .from(traces)
      .where(and(conditions, eq(traces.status, "error"))),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const errors = errorResult[0]?.count ?? 0;

  if (total === 0) {
    return 0;
  }

  return (errors / total) * 100;
}

/**
 * Get cost aggregated over time periods for a project within a date range.
 */
export async function getCostOverTime(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  groupBy?: GroupBy
): Promise<CostDataPoint[]> {
  const conditions = buildDateConditions(projectId, dateRange);

  let periodExpr: ReturnType<typeof sql>;
  switch (groupBy) {
    case "hour":
      periodExpr = sql`date_trunc('hour', ${traces.timestamp})`;
      break;
    case "model":
      periodExpr = sql`${traces.modelRequested}`;
      break;
    case "provider":
      periodExpr = sql`${traces.provider}`;
      break;
    case "day":
    default:
      periodExpr = sql`date_trunc('day', ${traces.timestamp})`;
      break;
  }

  const result = await db
    .select({
      period: periodExpr.as("period"),
      costCents: sum(traces.costCents).as("cost_cents"),
    })
    .from(traces)
    .where(conditions)
    .groupBy(periodExpr)
    .orderBy(periodExpr);

  return result.map((row) => ({
    period: String(row.period),
    costCents: Number(row.costCents ?? 0),
  }));
}

/**
 * Get total number of requests for a project within a date range.
 */
export async function getTotalRequests(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(traces)
    .where(buildDateConditions(projectId, dateRange));

  return result[0]?.total ?? 0;
}

/**
 * Get total number of unique sessions for a project within a date range.
 */
export async function getTotalSessions(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${traces.sessionId})` })
    .from(traces)
    .where(and(buildDateConditions(projectId, dateRange), isNotNull(traces.sessionId)));

  return Number(result[0]?.total ?? 0);
}

/**
 * Get total number of errors for a project within a date range.
 */
export async function getErrorCount(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(traces)
    .where(and(buildDateConditions(projectId, dateRange), eq(traces.status, "error")));

  return result[0]?.total ?? 0;
}

/**
 * Get cost breakdown by provider for a project within a date range.
 */
export async function getCostByProvider(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<CostByProvider[]> {
  const result = await db
    .select({
      provider: traces.provider,
      costCents: sum(traces.costCents),
      requests: count(),
    })
    .from(traces)
    .where(buildDateConditions(projectId, dateRange))
    .groupBy(traces.provider)
    .orderBy(desc(sum(traces.costCents)));

  return result.map((row) => ({
    provider: row.provider,
    costCents: Number(row.costCents ?? 0),
    requests: row.requests,
  }));
}

/**
 * Get stats breakdown by model for a project within a date range.
 */
export async function getStatsByModel(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  limit: number = 10
): Promise<StatsByModel[]> {
  const conditions = buildDateConditions(projectId, dateRange);

  const result = await db
    .select({
      provider: traces.provider,
      model: traces.modelRequested,
      requests: count(),
      costCents: sum(traces.costCents),
      avgLatency: avg(traces.latencyMs),
      totalTokens: sql<number>`SUM(COALESCE(${traces.inputTokens}, 0) + COALESCE(${traces.outputTokens}, 0))`,
      errorCount: sql<number>`COUNT(*) FILTER (WHERE ${traces.status} = 'error')`,
    })
    .from(traces)
    .where(conditions)
    .groupBy(traces.provider, traces.modelRequested)
    .orderBy(desc(count()))
    .limit(limit);

  return result.map((row) => ({
    provider: row.provider,
    model: row.model,
    requests: row.requests,
    costCents: Number(row.costCents ?? 0),
    avgLatency: Number(row.avgLatency ?? 0),
    totalTokens: Number(row.totalTokens ?? 0),
    errorRate: row.requests > 0 ? (Number(row.errorCount) / row.requests) * 100 : 0,
  }));
}

/**
 * Get latency distribution in buckets for a project within a date range.
 */
export async function getLatencyDistribution(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<LatencyBucket[]> {
  const conditions = and(buildDateConditions(projectId, dateRange), isNotNull(traces.latencyMs));

  const result = await db
    .select({
      bucket: sql<string>`
        CASE
          WHEN ${traces.latencyMs} < 200 THEN '0-200'
          WHEN ${traces.latencyMs} < 400 THEN '200-400'
          WHEN ${traces.latencyMs} < 600 THEN '400-600'
          WHEN ${traces.latencyMs} < 800 THEN '600-800'
          WHEN ${traces.latencyMs} < 1000 THEN '800-1k'
          WHEN ${traces.latencyMs} < 1500 THEN '1-1.5k'
          WHEN ${traces.latencyMs} < 2000 THEN '1.5-2k'
          ELSE '2k+'
        END
      `,
      count: count(),
    })
    .from(traces)
    .where(conditions).groupBy(sql`
      CASE
        WHEN ${traces.latencyMs} < 200 THEN '0-200'
        WHEN ${traces.latencyMs} < 400 THEN '200-400'
        WHEN ${traces.latencyMs} < 600 THEN '400-600'
        WHEN ${traces.latencyMs} < 800 THEN '600-800'
        WHEN ${traces.latencyMs} < 1000 THEN '800-1k'
        WHEN ${traces.latencyMs} < 1500 THEN '1-1.5k'
        WHEN ${traces.latencyMs} < 2000 THEN '1.5-2k'
        ELSE '2k+'
      END
    `).orderBy(sql`
      CASE
        WHEN ${traces.latencyMs} < 200 THEN 1
        WHEN ${traces.latencyMs} < 400 THEN 2
        WHEN ${traces.latencyMs} < 600 THEN 3
        WHEN ${traces.latencyMs} < 800 THEN 4
        WHEN ${traces.latencyMs} < 1000 THEN 5
        WHEN ${traces.latencyMs} < 1500 THEN 6
        WHEN ${traces.latencyMs} < 2000 THEN 7
        ELSE 8
      END
    `);

  return result.map((row) => ({
    bucket: row.bucket,
    count: row.count,
  }));
}

/**
 * Get latency percentiles (p50, p95, p99) for a project within a date range.
 */
export async function getLatencyPercentiles(
  db: Database,
  projectId: string,
  dateRange: DateRange
): Promise<LatencyPercentiles> {
  const conditions = and(buildDateConditions(projectId, dateRange), isNotNull(traces.latencyMs));

  const result = await db
    .select({
      p50: sql<number>`PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${traces.latencyMs})`,
      p95: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${traces.latencyMs})`,
      p99: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${traces.latencyMs})`,
    })
    .from(traces)
    .where(conditions);

  return {
    p50: Number(result[0]?.p50 ?? 0),
    p95: Number(result[0]?.p95 ?? 0),
    p99: Number(result[0]?.p99 ?? 0),
  };
}

/**
 * Get cost over time broken down by provider for a project within a date range.
 */
export async function getCostOverTimeByProvider(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  groupBy: "day" | "hour" = "day"
): Promise<CostOverTimeByProvider[]> {
  const conditions = buildDateConditions(projectId, dateRange);
  const periodExpr =
    groupBy === "hour"
      ? sql`date_trunc('hour', ${traces.timestamp})`
      : sql`date_trunc('day', ${traces.timestamp})`;

  const result = await db
    .select({
      period: periodExpr.as("period"),
      provider: traces.provider,
      costCents: sum(traces.costCents),
    })
    .from(traces)
    .where(conditions)
    .groupBy(periodExpr, traces.provider)
    .orderBy(periodExpr, traces.provider);

  return result.map((row) => ({
    period: String(row.period),
    provider: row.provider,
    costCents: Number(row.costCents ?? 0),
  }));
}
