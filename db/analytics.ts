import {
  eq,
  and,
  gte,
  lte,
  sql,
  sum,
  avg,
  count,
  isNotNull,
  desc,
} from "drizzle-orm";
import type { Database } from "./index";
import { traces, spans } from "./schema";
import type { GroupBy, SpanAnalyticsGroupBy } from "../shared/validation";

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
    lte(traces.timestamp, dateRange.dateTo),
  );
}

function buildSpanDateConditions(projectId: string, dateRange: DateRange) {
  return and(
    eq(spans.projectId, projectId),
    gte(spans.timestamp, dateRange.dateFrom),
    lte(spans.timestamp, dateRange.dateTo),
  );
}

/**
 * Get total cost in cents for a project within a date range.
 */
export async function getTotalCost(
  db: Database,
  projectId: string,
  dateRange: DateRange,
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
  dateRange: DateRange,
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
  dateRange: DateRange,
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
  dateRange: DateRange,
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
  groupBy?: GroupBy,
): Promise<CostDataPoint[]> {
  const conditions = buildDateConditions(projectId, dateRange);

  let periodExpr: ReturnType<typeof sql>;
  switch (groupBy) {
    case "hour":
      periodExpr = sql`to_char(date_trunc('hour', ${traces.timestamp}), 'YYYY-MM-DD HH24:00:00')`;
      break;
    case "model":
      periodExpr = sql`${traces.modelRequested}`;
      break;
    case "provider":
      periodExpr = sql`${traces.provider}`;
      break;
    case "day":
    default:
      periodExpr = sql`to_char(date_trunc('day', ${traces.timestamp}), 'YYYY-MM-DD')`;
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
  dateRange: DateRange,
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
  dateRange: DateRange,
): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${traces.sessionId})` })
    .from(traces)
    .where(
      and(
        buildDateConditions(projectId, dateRange),
        isNotNull(traces.sessionId),
      ),
    );

  return Number(result[0]?.total ?? 0);
}

/**
 * Get total number of errors for a project within a date range.
 */
export async function getErrorCount(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(traces)
    .where(
      and(
        buildDateConditions(projectId, dateRange),
        eq(traces.status, "error"),
      ),
    );

  return result[0]?.total ?? 0;
}

/**
 * Get cost breakdown by provider for a project within a date range.
 */
export async function getCostByProvider(
  db: Database,
  projectId: string,
  dateRange: DateRange,
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
  limit: number = 10,
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
    errorRate:
      row.requests > 0 ? (Number(row.errorCount) / row.requests) * 100 : 0,
  }));
}

/**
 * Get cost over time broken down by provider for a project within a date range.
 */
export async function getCostOverTimeByProvider(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  groupBy: "day" | "hour" = "day",
): Promise<CostOverTimeByProvider[]> {
  const conditions = buildDateConditions(projectId, dateRange);
  const periodExpr =
    groupBy === "hour"
      ? sql`to_char(date_trunc('hour', ${traces.timestamp}), 'YYYY-MM-DD HH24:00:00')`
      : sql`to_char(date_trunc('day', ${traces.timestamp}), 'YYYY-MM-DD')`;

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

export interface SpanCountByKind {
  kind: string;
  count: number;
}

export interface SpanCountBySource {
  source: string;
  count: number;
}

export interface SpanCountOverTime {
  period: string;
  count: number;
}

export interface TopToolUsage {
  name: string;
  count: number;
}

export async function getTotalSpanEvents(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(spans)
    .where(buildSpanDateConditions(projectId, dateRange));

  return result[0]?.total ?? 0;
}

export async function getSpanErrorRate(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const conditions = buildSpanDateConditions(projectId, dateRange);

  const [totalResult, errorResult] = await Promise.all([
    db.select({ count: count() }).from(spans).where(conditions),
    db
      .select({ count: count() })
      .from(spans)
      .where(and(conditions, eq(spans.status, "error"))),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const errors = errorResult[0]?.count ?? 0;
  if (total === 0) {
    return 0;
  }

  return (errors / total) * 100;
}

export async function getAvgSpanDuration(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const result = await db
    .select({ avgDuration: avg(spans.durationMs) })
    .from(spans)
    .where(buildSpanDateConditions(projectId, dateRange));

  return Number(result[0]?.avgDuration ?? 0);
}

export async function getSpanCountsByKind(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<SpanCountByKind[]> {
  const result = await db
    .select({
      kind: spans.kind,
      count: count(),
    })
    .from(spans)
    .where(buildSpanDateConditions(projectId, dateRange))
    .groupBy(spans.kind)
    .orderBy(desc(count()));

  return result.map((row) => ({
    kind: row.kind,
    count: row.count,
  }));
}

export async function getSpanCountsBySource(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<SpanCountBySource[]> {
  const result = await db
    .select({
      source: spans.source,
      count: count(),
    })
    .from(spans)
    .where(buildSpanDateConditions(projectId, dateRange))
    .groupBy(spans.source)
    .orderBy(desc(count()));

  return result.map((row) => ({
    source: row.source,
    count: row.count,
  }));
}

export async function getSpanCountsOverTime(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  groupBy: SpanAnalyticsGroupBy = "day",
): Promise<SpanCountOverTime[]> {
  const conditions = buildSpanDateConditions(projectId, dateRange);
  const periodExpr =
    groupBy === "hour"
      ? sql`to_char(date_trunc('hour', ${spans.timestamp}), 'YYYY-MM-DD HH24:00:00')`
      : sql`to_char(date_trunc('day', ${spans.timestamp}), 'YYYY-MM-DD')`;

  const result = await db
    .select({
      period: periodExpr.as("period"),
      count: count(),
    })
    .from(spans)
    .where(conditions)
    .groupBy(periodExpr)
    .orderBy(periodExpr);

  return result.map((row) => ({
    period: String(row.period),
    count: row.count,
  }));
}

export async function getAvgSessionSpanDuration(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const result = await db
    .select({ avgDuration: avg(spans.durationMs) })
    .from(spans)
    .where(
      and(
        buildSpanDateConditions(projectId, dateRange),
        eq(spans.kind, "session"),
      ),
    );

  return Number(result[0]?.avgDuration ?? 0);
}

export async function getTopTools(
  db: Database,
  projectId: string,
  dateRange: DateRange,
  limit: number = 5,
): Promise<TopToolUsage[]> {
  const result = await db
    .select({
      name: spans.toolName,
      count: count(),
    })
    .from(spans)
    .where(
      and(
        buildSpanDateConditions(projectId, dateRange),
        eq(spans.kind, "tool_use"),
        isNotNull(spans.toolName),
      ),
    )
    .groupBy(spans.toolName)
    .orderBy(desc(count()))
    .limit(limit);

  return result.map((row) => ({
    name: row.name ?? "unknown",
    count: row.count,
  }));
}
