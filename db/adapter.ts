import type {
  Trace,
  NewTrace,
  Session,
  NewSession,
  Span,
  NewSpan,
} from "./schema";

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
 * Query filters for span lookups.
 */
export interface SpanQueryFilters {
  sessionId?: string;
  source?: "claude_code" | "opencode" | "openclaw";
  kind?: "tool_use" | "agent_run" | "session" | "user_prompt" | "notification";
  toolName?: string;
  status?: "success" | "error";
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Result of a paginated span query.
 */
export interface SpanQueryResult {
  spans: Span[];
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
   * Insert a trace idempotently (skip if already exists).
   * Used by WAL processing for crash recovery.
   */
  insertTraceIdempotent(projectId: string, trace: NewTrace): Promise<Trace>;

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
    filters?: TraceQueryFilters,
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
  upsertSession(projectId: string, session: NewSession): Promise<Session>;

  /**
   * Get all traces for a session, ordered by timestamp ascending.
   */
  getSessionTraces(sessionId: string, projectId: string): Promise<Trace[]>;

  /**
   * Get all spans for a session, ordered by timestamp ascending.
   */
  getSessionSpans(sessionId: string, projectId: string): Promise<Span[]>;

  /**
   * Insert a new span into storage.
   */
  insertSpan(projectId: string, span: NewSpan): Promise<Span>;

  /**
   * Insert a span idempotently (skip if already exists).
   * Used by WAL processing for crash recovery.
   */
  insertSpanIdempotent(projectId: string, span: NewSpan): Promise<Span>;

  /**
   * Get a single span by ID, scoped to a project.
   * Returns null if not found.
   */
  getSpan(spanId: string, projectId: string): Promise<Span | null>;

  /**
   * Query spans for a project with optional filters and pagination.
   */
  querySpans(
    projectId: string,
    filters?: SpanQueryFilters,
  ): Promise<SpanQueryResult>;

  /**
   * Count spans for a project with optional filters.
   */
  countSpans(projectId: string, filters?: SpanQueryFilters): Promise<number>;
}
