import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import type { Database } from "./index";
import { traces, sessions } from "./schema";
import type { Trace, NewTrace, Session, NewSession } from "./schema";
import type {
  StorageAdapter,
  TraceQueryFilters,
  TraceQueryResult,
} from "./adapter";
import { db } from "./index";

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
}

export const storage = new PostgresStorage(db);
