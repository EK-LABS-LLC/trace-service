import type { Span, NewSpan } from "./schema";

/**
 * Query filters for trace lookups.
 */
export interface TraceQueryFilters {
  sessionId?: string;
  source?: string;
  provider?: string;
  model?: string;
  status?: "success" | "error";
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query filters for span lookups.
 */
export interface SpanQueryFilters {
  sessionId?: string;
  traceId?: string;
  source?: "claude_code" | "codex" | "opencode" | "openclaw" | "sdk";
  kind?:
    | "llm_call"
    | "tool_use"
    | "agent_run"
    | "session"
    | "user_prompt"
    | "llm_response"
    | "notification";
  toolName?: string;
  status?: "success" | "error";
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export type AgentSessionSort =
  "recent" | "oldest" | "duration" | "errors" | "volume";

export interface AgentSessionQueryFilters {
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sort?: AgentSessionSort;
}

export interface AgentSessionSummaryRow {
  sessionId: string;
  firstTimestamp: Date | string | number;
  lastTimestamp: Date | string | number;
  totalSpans: number;
  agentRuns: number;
  toolCalls: number;
  errorCount: number;
  sessionDurationMs: number | null;
  source: string | null;
  cwd: string | null;
  model: string | null;
  agentName: string | null;
}

export interface AgentSessionQueryResult {
  sessions: AgentSessionSummaryRow[];
  total: number;
}

/**
 * Result of a paginated span query.
 */
export interface SpanQueryResult {
  spans: Span[];
  total: number;
}

export interface TraceIdQueryResult {
  traceIds: string[];
  total: number;
}

/**
 * Storage adapter interface for Pulse trace storage.
 *
 * Implement this interface to add support for different storage backends.
 * The default implementation is SqliteStorage (see sqlite.ts).
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
   * Insert a batch of spans idempotently, chunked into multiple statements to
   * stay under the driver's bound-parameter limit. Duplicate (project_id,
   * span_id) rows are skipped; only newly inserted spans are returned. Used by
   * both legacy span-batch and OTLP ingestion, where exporters retry batches
   * and must never fail on already-stored spans.
   */
  insertSpans(projectId: string, spans: NewSpan[]): Promise<Span[]>;

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
   * Query agent sessions grouped from spans for a project.
   */
  queryAgentSessions(
    projectId: string,
    filters?: AgentSessionQueryFilters,
  ): Promise<AgentSessionQueryResult>;

  /**
   * Count spans for a project with optional filters.
   */
  countSpans(projectId: string, filters?: SpanQueryFilters): Promise<number>;

  /** Query distinct trace ids across all sources, in trace-summary order. */
  queryTraceIds(
    projectId: string,
    filters?: TraceQueryFilters,
  ): Promise<TraceIdQueryResult>;
}
