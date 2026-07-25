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
import { getDbDialect } from "./index";
import { spans } from "./schema";
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

function buildSpanDateConditions(projectId: string, dateRange: DateRange) {
  return and(
    eq(spans.projectId, projectId),
    gte(spans.timestamp, dateRange.dateFrom),
    lte(spans.timestamp, dateRange.dateTo),
  );
}

/**
 * SDK provider calls land in the spans table as llm_call spans, so the
 * request-level analytics aggregate those directly.
 */
function buildLlmSpanConditions(projectId: string, dateRange: DateRange) {
  return and(
    buildSpanDateConditions(projectId, dateRange),
    eq(spans.kind, "llm_call"),
  );
}

const spanProviderExpr = sql<string>`COALESCE(${spans.provider}, 'sdk')`;
const spanModelExpr = sql<string>`COALESCE(${spans.model}, 'unknown')`;

function spanPeriodExpr(
  groupBy: SpanAnalyticsGroupBy = "day",
): ReturnType<typeof sql> {
  if (getDbDialect() === "postgres") {
    return groupBy === "hour"
      ? sql`to_char(date_trunc('hour', ${spans.timestamp}), 'YYYY-MM-DD HH24:00:00')`
      : sql`to_char(date_trunc('day', ${spans.timestamp}), 'YYYY-MM-DD')`;
  }

  return groupBy === "hour"
    ? sql`strftime('%Y-%m-%d %H:00:00', ${spans.timestamp} / 1000, 'unixepoch')`
    : sql`strftime('%Y-%m-%d', ${spans.timestamp} / 1000, 'unixepoch')`;
}

function llmSpanPeriodExpr(groupBy?: GroupBy): ReturnType<typeof sql> {
  switch (groupBy) {
    case "model":
      return spanModelExpr;
    case "provider":
      return spanProviderExpr;
    case "hour":
    case "day":
    default:
      return spanPeriodExpr(groupBy === "hour" ? "hour" : "day");
  }
}

/**
 * Get total cost in cents for a project within a date range.
 */
export async function getTotalCost(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const [spanResult] = await db
    .select({ total: sum(spans.costCents) })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange));

  return Number(spanResult?.total ?? 0);
}

/**
 * Get total tokens (input + output) for a project within a date range.
 */
export async function getTotalTokens(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number }> {
  const [spanResult] = await db
    .select({
      inputTokens: sum(spans.inputTokens),
      outputTokens: sum(spans.outputTokens),
    })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange));

  const inputTokens = Number(spanResult?.inputTokens ?? 0);
  const outputTokens = Number(spanResult?.outputTokens ?? 0);

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
  const [spanResult] = await db
    .select({ total: sum(spans.durationMs), count: count(spans.durationMs) })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange));

  const totalLatency = Number(spanResult?.total ?? 0);
  const totalCount = Number(spanResult?.count ?? 0);
  return totalCount === 0 ? 0 : totalLatency / totalCount;
}

/**
 * Get error rate (percentage of requests with error status) for a project within a date range.
 */
export async function getErrorRate(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const spanConditions = buildLlmSpanConditions(projectId, dateRange);

  const [spanTotalResult, spanErrorResult] = await Promise.all([
    db.select({ count: count() }).from(spans).where(spanConditions),
    db
      .select({ count: count() })
      .from(spans)
      .where(and(spanConditions, eq(spans.status, "error"))),
  ]);

  const total = spanTotalResult[0]?.count ?? 0;
  const errors = spanErrorResult[0]?.count ?? 0;

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
  const spanPeriod = llmSpanPeriodExpr(groupBy);

  const spanRows = await db
    .select({
      period: spanPeriod.as("period"),
      costCents: sum(spans.costCents).as("cost_cents"),
    })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange))
    .groupBy(spanPeriod)
    .orderBy(spanPeriod);

  const byPeriod = new Map<string, number>();
  for (const row of spanRows as any[]) {
    const period = String(row.period);
    byPeriod.set(
      period,
      (byPeriod.get(period) ?? 0) + Number(row.costCents ?? 0),
    );
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, costCents]) => ({ period, costCents }));
}

/**
 * Get total number of requests for a project within a date range.
 */
export async function getTotalRequests(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const [spanResult] = await db
    .select({ total: count() })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange));

  return spanResult?.total ?? 0;
}

/**
 * Get total number of unique sessions for a project within a date range.
 */
export async function getTotalSessions(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const spanRows = await db
    .selectDistinct({ sessionId: spans.sessionId })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange));

  return new Set(
    (spanRows as Array<{ sessionId: string | null }>)
      .map((row) => row.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  ).size;
}

/**
 * Get total number of errors for a project within a date range.
 */
export async function getErrorCount(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<number> {
  const [spanResult] = await db
    .select({ total: count() })
    .from(spans)
    .where(
      and(
        buildLlmSpanConditions(projectId, dateRange),
        eq(spans.status, "error"),
      ),
    );

  return spanResult?.total ?? 0;
}

/**
 * Get cost breakdown by provider for a project within a date range.
 */
export async function getCostByProvider(
  db: Database,
  projectId: string,
  dateRange: DateRange,
): Promise<CostByProvider[]> {
  const spanRows = await db
    .select({
      provider: spanProviderExpr.as("provider"),
      costCents: sum(spans.costCents),
      requests: count(),
    })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange))
    .groupBy(spanProviderExpr);

  const byProvider = new Map<string, CostByProvider>();
  for (const row of spanRows as any[]) {
    const provider = String(row.provider ?? "unknown");
    const entry = byProvider.get(provider) ?? {
      provider,
      costCents: 0,
      requests: 0,
    };
    entry.costCents += Number(row.costCents ?? 0);
    entry.requests += Number(row.requests ?? 0);
    byProvider.set(provider, entry);
  }

  return [...byProvider.values()].sort((a, b) => b.costCents - a.costCents);
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
  const spanRows = await db
    .select({
      provider: spanProviderExpr.as("provider"),
      model: spanModelExpr.as("model"),
      requests: count(),
      costCents: sum(spans.costCents),
      totalLatency: sum(spans.durationMs),
      latencyCount: count(spans.durationMs),
      totalTokens: sql<number>`SUM(COALESCE(${spans.inputTokens}, 0) + COALESCE(${spans.outputTokens}, 0))`,
      errorCount: sql<number>`SUM(CASE WHEN ${spans.status} = 'error' THEN 1 ELSE 0 END)`,
    })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange))
    .groupBy(spanProviderExpr, spanModelExpr);

  interface ModelAccumulator {
    provider: string;
    model: string;
    requests: number;
    costCents: number;
    totalLatency: number;
    latencyCount: number;
    totalTokens: number;
    errorCount: number;
  }

  const byModel = new Map<string, ModelAccumulator>();
  for (const row of spanRows as any[]) {
    const provider = String(row.provider ?? "unknown");
    const model = String(row.model ?? "unknown");
    const key = `${provider} ${model}`;
    const entry = byModel.get(key) ?? {
      provider,
      model,
      requests: 0,
      costCents: 0,
      totalLatency: 0,
      latencyCount: 0,
      totalTokens: 0,
      errorCount: 0,
    };
    entry.requests += Number(row.requests ?? 0);
    entry.costCents += Number(row.costCents ?? 0);
    entry.totalLatency += Number(row.totalLatency ?? 0);
    entry.latencyCount += Number(row.latencyCount ?? 0);
    entry.totalTokens += Number(row.totalTokens ?? 0);
    entry.errorCount += Number(row.errorCount ?? 0);
    byModel.set(key, entry);
  }

  return [...byModel.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit)
    .map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      requests: entry.requests,
      costCents: entry.costCents,
      avgLatency:
        entry.latencyCount > 0 ? entry.totalLatency / entry.latencyCount : 0,
      totalTokens: entry.totalTokens,
      errorRate:
        entry.requests > 0 ? (entry.errorCount / entry.requests) * 100 : 0,
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
  const spanPeriod = spanPeriodExpr(groupBy);

  const spanRows = await db
    .select({
      period: spanPeriod.as("period"),
      provider: spanProviderExpr.as("provider"),
      costCents: sum(spans.costCents),
    })
    .from(spans)
    .where(buildLlmSpanConditions(projectId, dateRange))
    .groupBy(spanPeriod, spanProviderExpr);

  const byKey = new Map<string, CostOverTimeByProvider>();
  for (const row of spanRows as any[]) {
    const period = String(row.period);
    const provider = String(row.provider ?? "unknown");
    const key = `${period} ${provider}`;
    const entry = byKey.get(key) ?? { period, provider, costCents: 0 };
    entry.costCents += Number(row.costCents ?? 0);
    byKey.set(key, entry);
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.period.localeCompare(b.period) || a.provider.localeCompare(b.provider),
  );
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

  return result.map((row: any) => ({
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

  return result.map((row: any) => ({
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
  const periodExpr = spanPeriodExpr(groupBy);

  const result = await db
    .select({
      period: periodExpr.as("period"),
      count: count(),
    })
    .from(spans)
    .where(conditions)
    .groupBy(periodExpr)
    .orderBy(periodExpr);

  return result.map((row: any) => ({
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

  return result.map((row: any) => ({
    name: row.name ?? "unknown",
    count: row.count,
  }));
}
