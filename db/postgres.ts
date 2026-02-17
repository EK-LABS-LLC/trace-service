import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import type { Database } from "./index";
import { traces, sessions, spans } from "./schema";
import type {
  Trace,
  NewTrace,
  Session,
  NewSession,
  Span,
  NewSpan,
} from "./schema";
import type {
  StorageAdapter,
  TraceQueryFilters,
  TraceQueryResult,
  SpanQueryFilters,
  SpanQueryResult,
} from "./adapter";

/**
 * PostgreSQL implementation of the StorageAdapter interface.
 * This is the default storage backend for Pulse.
 */
export class PostgresStorage implements StorageAdapter {
  constructor(private db: Database) {}

  async insertTrace(projectId: string, trace: NewTrace): Promise<Trace> {
    const result = await this.db
      .insert(traces)
      .values({ ...trace, projectId })
      .returning();
    return result[0]!;
  }

  async insertTraceIdempotent(projectId: string, trace: NewTrace): Promise<Trace> {
    const inserted = await this.db
      .insert(traces)
      .values({ ...trace, projectId })
      .onConflictDoNothing({ target: traces.traceId })
      .returning();
    if (inserted[0]) {
      return inserted[0];
    }

    const existing = await this.getTrace(trace.traceId!, projectId);
    if (!existing) {
      throw new Error(`Idempotent insert failed to find trace ${trace.traceId}`);
    }
    return existing;
  }

  async getTrace(traceId: string, projectId: string): Promise<Trace | null> {
    const [trace] = await this.db
      .select()
      .from(traces)
      .where(and(eq(traces.traceId, traceId), eq(traces.projectId, projectId)))
      .limit(1);
    return trace ?? null;
  }

  async queryTraces(
    projectId: string,
    filters: TraceQueryFilters = {},
  ): Promise<TraceQueryResult> {
    const conditions = [eq(traces.projectId, projectId)];

    if (filters.sessionId) {
      conditions.push(eq(traces.sessionId, filters.sessionId));
    }
    if (filters.provider) {
      conditions.push(eq(traces.provider, filters.provider));
    }
    if (filters.model) {
      conditions.push(eq(traces.modelRequested, filters.model));
    }
    if (filters.status) {
      conditions.push(eq(traces.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(traces.timestamp, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(traces.timestamp, filters.dateTo));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ total: count() })
      .from(traces)
      .where(whereClause);
    const total = countResult[0]?.total ?? 0;

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const results = await this.db
      .select()
      .from(traces)
      .where(whereClause)
      .orderBy(sql`${traces.timestamp} DESC`)
      .limit(limit)
      .offset(offset);

    return { traces: results, total };
  }

  async countTraces(
    projectId: string,
    filters: TraceQueryFilters = {},
  ): Promise<number> {
    const conditions = [eq(traces.projectId, projectId)];

    if (filters.sessionId) {
      conditions.push(eq(traces.sessionId, filters.sessionId));
    }
    if (filters.provider) {
      conditions.push(eq(traces.provider, filters.provider));
    }
    if (filters.model) {
      conditions.push(eq(traces.modelRequested, filters.model));
    }
    if (filters.status) {
      conditions.push(eq(traces.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(traces.timestamp, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(traces.timestamp, filters.dateTo));
    }

    const countResult = await this.db
      .select({ total: count() })
      .from(traces)
      .where(and(...conditions));

    return countResult[0]?.total ?? 0;
  }

  async upsertSession(
    projectId: string,
    session: NewSession,
  ): Promise<Session> {
    const insert = this.db.insert(sessions).values({ ...session, projectId });

    const withConflict =
      session.metadata !== undefined
        ? insert.onConflictDoUpdate({
            target: sessions.id,
            set: { metadata: session.metadata },
          })
        : insert.onConflictDoNothing({ target: sessions.id });

    const result = await withConflict.returning();
    return result[0]!;
  }

  async getSessionTraces(
    sessionId: string,
    projectId: string,
  ): Promise<Trace[]> {
    return this.db
      .select()
      .from(traces)
      .where(
        and(eq(traces.sessionId, sessionId), eq(traces.projectId, projectId)),
      )
      .orderBy(sql`${traces.timestamp} ASC`);
  }

  async getSessionSpans(
    sessionId: string,
    projectId: string,
  ): Promise<Span[]> {
    return this.db
      .select()
      .from(spans)
      .where(and(eq(spans.sessionId, sessionId), eq(spans.projectId, projectId)))
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
      .onConflictDoNothing({ target: spans.spanId })
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

  async countSpans(
    projectId: string,
    filters: SpanQueryFilters = {},
  ): Promise<number> {
    const conditions = [eq(spans.projectId, projectId)];

    if (filters.sessionId) {
      conditions.push(eq(spans.sessionId, filters.sessionId));
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
}
