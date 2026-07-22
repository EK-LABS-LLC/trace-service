import { eq, and, gte, lte, count, desc, sql, notInArray } from "drizzle-orm";
import { spans } from "./schema-scale";
import type { Span, NewSpan } from "./schema-scale";
import type {
  StorageAdapter,
  TraceQueryFilters,
  AgentSessionQueryFilters,
  AgentSessionQueryResult,
  SpanQueryFilters,
  SpanQueryResult,
  TraceIdQueryResult,
} from "./adapter";

/**
 * PostgreSQL implementation of the StorageAdapter interface.
 * This is the default storage backend for Pulse.
 */
export class PostgresStorage implements StorageAdapter {
  constructor(private db: any) {}

  async getSessionSpans(sessionId: string, projectId: string): Promise<Span[]> {
    return this.db
      .select()
      .from(spans)
      .where(
        and(eq(spans.sessionId, sessionId), eq(spans.projectId, projectId)),
      )
      .orderBy(sql`${spans.timestamp} ASC`);
  }

  async insertSpan(projectId: string, span: NewSpan): Promise<Span> {
    const result = await this.db
      .insert(spans)
      .values({ ...span, projectId })
      .returning();
    return result[0]!;
  }

  async insertSpanIdempotent(projectId: string, span: NewSpan): Promise<Span> {
    const inserted = await this.db
      .insert(spans)
      .values({ ...span, projectId })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      return inserted[0];
    }

    const existing = await this.getSpan(span.spanId!, projectId);
    if (!existing) {
      throw new Error(`Idempotent insert failed to find span ${span.spanId}`);
    }
    return existing;
  }

  async insertSpans(projectId: string, spanBatch: NewSpan[]): Promise<Span[]> {
    const inserted: Span[] = [];
    // Chunked multi-row inserts: each statement is atomic and keeps the
    // parameter count bounded.
    for (let i = 0; i < spanBatch.length; i += 250) {
      const chunk = spanBatch
        .slice(i, i + 250)
        .map((span) => ({ ...span, projectId }));
      const rows = await this.db
        .insert(spans)
        .values(chunk)
        .onConflictDoNothing()
        .returning();
      inserted.push(...rows);
    }
    return inserted;
  }

  async getSpan(spanId: string, projectId: string): Promise<Span | null> {
    const [span] = await this.db
      .select()
      .from(spans)
      .where(and(eq(spans.spanId, spanId), eq(spans.projectId, projectId)))
      .limit(1);
    return span ?? null;
  }

  async querySpans(
    projectId: string,
    filters: SpanQueryFilters = {},
  ): Promise<SpanQueryResult> {
    const conditions = [eq(spans.projectId, projectId)];

    if (filters.sessionId) {
      conditions.push(eq(spans.sessionId, filters.sessionId));
    }
    if (filters.traceId) {
      conditions.push(eq(spans.traceId, filters.traceId));
    }
    if (filters.source) {
      conditions.push(eq(spans.source, filters.source));
    }
    if (filters.kind) {
      conditions.push(eq(spans.kind, filters.kind));
    }
    if (filters.toolName) {
      conditions.push(eq(spans.toolName, filters.toolName));
    }
    if (filters.status) {
      conditions.push(eq(spans.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(spans.timestamp, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(spans.timestamp, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const countResult = await this.db
      .select({ total: count() })
      .from(spans)
      .where(whereClause);
    const total = countResult[0]?.total ?? 0;

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const results = await this.db
      .select()
      .from(spans)
      .where(whereClause)
      .orderBy(sql`${spans.timestamp} DESC`)
      .limit(limit)
      .offset(offset);

    return { spans: results, total };
  }

  async queryAgentSessions(
    projectId: string,
    filters: AgentSessionQueryFilters = {},
  ): Promise<AgentSessionQueryResult> {
    const conditions = [eq(spans.projectId, projectId)];

    if (filters.dateFrom) {
      conditions.push(gte(spans.timestamp, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(spans.timestamp, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const countResult = await this.db
      .select({ total: sql<number>`COUNT(DISTINCT ${spans.sessionId})` })
      .from(spans)
      .where(whereClause);
    const total = Number(countResult[0]?.total ?? 0);

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    const sort = filters.sort ?? "recent";
    const firstTimestamp = sql<Date>`MIN(${spans.timestamp})`;
    const lastTimestamp = sql<Date>`MAX(${spans.timestamp})`;
    const durationMs = sql<number>`COALESCE(MAX(CASE WHEN ${spans.kind} = 'session' THEN ${spans.durationMs} END), EXTRACT(EPOCH FROM (MAX(${spans.timestamp}) - MIN(${spans.timestamp}))) * 1000, 0)`;
    const errorCount = sql<number>`SUM(CASE WHEN ${spans.status} = 'error' THEN 1 ELSE 0 END)`;
    const totalSpans = count();

    const orderBy = (() => {
      switch (sort) {
        case "oldest":
          return [sql`${firstTimestamp} ASC`, sql`${spans.sessionId} ASC`];
        case "duration":
          return [
            sql`${durationMs} DESC`,
            sql`${lastTimestamp} DESC`,
            sql`${spans.sessionId} ASC`,
          ];
        case "errors":
          return [
            sql`${errorCount} DESC`,
            sql`${lastTimestamp} DESC`,
            sql`${spans.sessionId} ASC`,
          ];
        case "volume":
          return [
            sql`${totalSpans} DESC`,
            sql`${lastTimestamp} DESC`,
            sql`${spans.sessionId} ASC`,
          ];
        case "recent":
        default:
          return [sql`${lastTimestamp} DESC`, sql`${spans.sessionId} ASC`];
      }
    })();

    const sessions = await this.db
      .select({
        sessionId: spans.sessionId,
        firstTimestamp,
        lastTimestamp,
        totalSpans,
        agentRuns: sql<number>`SUM(CASE WHEN ${spans.kind} = 'agent_run' THEN 1 ELSE 0 END)`,
        toolCalls: sql<number>`COUNT(DISTINCT CASE WHEN ${spans.kind} = 'tool_use' THEN COALESCE(${spans.toolUseId}, ${spans.spanId}) END)`,
        errorCount,
        sessionDurationMs: sql<
          number | null
        >`MAX(CASE WHEN ${spans.kind} = 'session' THEN ${spans.durationMs} END)`,
        source: sql<string | null>`MAX(${spans.source})`,
        cwd: sql<string | null>`MAX(${spans.cwd})`,
        model: sql<string | null>`MAX(${spans.model})`,
        agentName: sql<string | null>`MAX(${spans.agentName})`,
      })
      .from(spans)
      .where(whereClause)
      .groupBy(spans.sessionId)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return { sessions, total };
  }

  async countSpans(
    projectId: string,
    filters: SpanQueryFilters = {},
  ): Promise<number> {
    const conditions = [eq(spans.projectId, projectId)];

    if (filters.sessionId) {
      conditions.push(eq(spans.sessionId, filters.sessionId));
    }
    if (filters.traceId) {
      conditions.push(eq(spans.traceId, filters.traceId));
    }
    if (filters.source) {
      conditions.push(eq(spans.source, filters.source));
    }
    if (filters.kind) {
      conditions.push(eq(spans.kind, filters.kind));
    }
    if (filters.toolName) {
      conditions.push(eq(spans.toolName, filters.toolName));
    }
    if (filters.status) {
      conditions.push(eq(spans.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(spans.timestamp, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(spans.timestamp, filters.dateTo));
    }

    const countResult = await this.db
      .select({ total: count() })
      .from(spans)
      .where(and(...conditions));
    return countResult[0]?.total ?? 0;
  }

  async queryTraceIds(
    projectId: string,
    filters: TraceQueryFilters = {},
  ): Promise<TraceIdQueryResult> {
    const conditions = [
      eq(spans.projectId, projectId),
      notInArray(spans.eventType, ["session_start", "session_end"]),
    ];
    if (filters.source) conditions.push(eq(spans.source, filters.source));
    if (filters.sessionId)
      conditions.push(eq(spans.sessionId, filters.sessionId));
    if (filters.dateFrom)
      conditions.push(gte(spans.timestamp, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(spans.timestamp, filters.dateTo));
    const whereClause = and(...conditions);
    const provider = sql<string>`COALESCE(MAX(CASE WHEN ${spans.kind} = 'llm_call' THEN ${spans.provider} END), MAX(${spans.source}))`;
    const model = sql<string>`COALESCE(MAX(CASE WHEN ${spans.kind} = 'llm_call' THEN ${spans.model} END), 'unknown')`;
    const errors = sql<number>`SUM(CASE WHEN ${spans.status} = 'error' THEN 1 ELSE 0 END)`;
    const having = and(
      filters.provider ? sql`${provider} = ${filters.provider}` : undefined,
      filters.model ? sql`${model} = ${filters.model}` : undefined,
      filters.status === "error" ? sql`${errors} > 0` : undefined,
      filters.status === "success" ? sql`${errors} = 0` : undefined,
    );
    const groups = this.db
      .select({
        traceId: spans.traceId,
        timestamp: sql<Date>`MIN(${spans.timestamp})`.as("timestamp"),
      })
      .from(spans)
      .where(whereClause)
      .groupBy(spans.traceId)
      .having(having)
      .as("trace_groups");
    const [countRows, rows] = await Promise.all([
      this.db.select({ total: count() }).from(groups),
      this.db
        .select({ traceId: groups.traceId })
        .from(groups)
        .orderBy(desc(groups.timestamp))
        .limit(filters.limit ?? 100)
        .offset(filters.offset ?? 0),
    ]);
    return {
      traceIds: rows
        .map((row: { traceId: string }) => row.traceId)
        .filter((id: string): id is string => id != null),
      total: countRows[0]?.total ?? 0,
    };
  }
}
