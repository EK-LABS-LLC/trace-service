import type { Trace, NewTrace, Session, NewSession } from "./schema";

/**
 * Query filters for trace lookups.
 */
export interface TraceQueryFilters {
  sessionId?: string;
  provider?: string;
  model?: string;
  status?: "success" | "error";
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Result of a paginated trace query.
 */
export interface TraceQueryResult {
  traces: Trace[];
  total: number;
}

/**
 * Storage adapter interface for Pulse trace storage.
 *
 * Implement this interface to add support for different storage backends.
 * The default implementation is PostgresStorage (see postgres.ts).
 *
 * @example
 * ```ts
 * class MyCustomStorage implements StorageAdapter {
 *   // implement all methods
 * }
 * ```
 */
export interface StorageAdapter {
  /**
   * Insert a new trace into storage.
   */
  insertTrace(projectId: string, trace: NewTrace): Promise<Trace>;

  /**
   * Get a single trace by ID, scoped to a project.
   * Returns null if not found.
   */
  getTrace(traceId: string, projectId: string): Promise<Trace | null>;

  /**
   * Query traces for a project with optional filters and pagination.
   */
  queryTraces(
    projectId: string,
    filters?: TraceQueryFilters
  ): Promise<TraceQueryResult>; 

  /**
   * Count traces for a project with optional filters.
   */
  countTraces(projectId: string, filters?: TraceQueryFilters): Promise<number>;

  /**
   * Insert or update a session.
   * If a session with the given ID exists, update its metadata.
   * Otherwise, create a new session.
   */
  upsertSession(
    projectId: string,
    session: NewSession
  ): Promise<Session>;

  /**
   * Get all traces for a session, ordered by timestamp ascending.
   */
  getSessionTraces(sessionId: string, projectId: string): Promise<Trace[]>;
}
