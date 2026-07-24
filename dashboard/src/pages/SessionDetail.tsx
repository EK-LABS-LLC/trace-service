import { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import type { Trace } from "../lib/apiClient";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useSessionTraceSummariesQuery } from "../api";
import { useProject } from "../hooks/useProject";

const SOURCE_LABELS: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  sdk: "SDK",
};

const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;

const BackIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const CopyIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number): string {
  const diffSecs = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(diffSecs / 3600);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (hours > 0) {
    return `${hours}h ${mins % 60}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatCost(cents: number | null): string {
  if (cents === null) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms}ms`;
}

interface SessionStats {
  traceCount: number;
  spanCount: number;
  errorCount: number;
  duration: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

function calculateSessionStats(traces: Trace[]): SessionStats {
  const sorted = [...traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const spanCount = sorted.reduce((sum, t) => sum + (t.spanCount || 0), 0);
  const errorCount = sorted.filter((t) => t.status === "error").length;
  const inputTokens = sorted.reduce((sum, t) => sum + (t.inputTokens ?? 0), 0);
  const outputTokens = sorted.reduce(
    (sum, t) => sum + (t.outputTokens ?? 0),
    0,
  );
  const costCents = sorted.reduce((sum, t) => sum + (t.costCents ?? 0), 0);
  const starts = sorted.map((trace) => new Date(trace.timestamp).getTime());
  const ends = sorted.map(
    (trace) => new Date(trace.timestamp).getTime() + trace.latencyMs,
  );
  const duration =
    starts.length > 0
      ? formatDuration(Math.max(...ends) - Math.min(...starts))
      : "0s";

  return {
    traceCount: sorted.length,
    spanCount,
    errorCount,
    duration,
    inputTokens,
    outputTokens,
    costCents,
  };
}

interface CopyButtonProps {
  text: string;
  className?: string;
}

function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

interface TraceCardProps {
  trace: Trace;
  isLatest: boolean;
  onClick: () => void;
}

function TraceCard({ trace, isLatest, onClick }: TraceCardProps) {
  const isError = trace.status === "error";
  const totalTokens = (trace.inputTokens ?? 0) + (trace.outputTokens ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full bg-neutral-900 border rounded-lg p-3 text-left hover:bg-neutral-850 cursor-pointer transition-colors ${
        isLatest ? "border-accent/30" : "border-neutral-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isError ? "bg-error" : "bg-success"}`}
          ></span>
          <span className="text-xs font-mono text-neutral-300">
            {trace.traceId.slice(0, 8)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
            {sourceLabel(trace.source)}
          </span>
          {isLatest && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
              Latest
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-500">
          {formatTime(trace.timestamp)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-neutral-400 truncate">{trace.summary}</span>
        <div className="flex items-center gap-3 text-neutral-500 flex-shrink-0">
          <span>{trace.spanCount} spans</span>
          {trace.latencyMs > 0 && <span>{formatLatency(trace.latencyMs)}</span>}
          {totalTokens > 0 && (
            <span>{totalTokens.toLocaleString()} tokens</span>
          )}
          {trace.costCents !== null && (
            <span>{formatCost(trace.costCents)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function SessionDetail() {
  const { selectedProject } = useProject();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as { returnTo?: unknown } | null;
  const returnTo =
    typeof locationState?.returnTo === "string" &&
    locationState.returnTo.startsWith("/dashboard/sessions")
      ? locationState.returnTo
      : "/dashboard/sessions";

  const sessionQuery = useSessionTraceSummariesQuery(selectedProject?.id, id);
  const session = sessionQuery.data ?? null;
  const loading = sessionQuery.isPending;
  const error =
    sessionQuery.error instanceof Error ? sessionQuery.error.message : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner text="Loading session..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-rose-400 mb-4">{error}</div>
          <button
            onClick={() => sessionQuery.refetch()}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-100 mb-2">
            Session not found
          </h1>
          <p className="text-neutral-500 mb-6">
            The session you're looking for doesn't exist.
          </p>
          <Link to={returnTo} className="text-accent hover:underline">
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  const sessionId = session.sessionId || id || "";
  const traces = [...session.traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const stats = calculateSessionStats(traces);
  const firstTrace = traces[0];
  const sources = [...new Set(traces.map((trace) => trace.source))];
  const user = firstTrace?.metadata?.user as string | undefined;
  const feature = firstTrace?.metadata?.feature as string | undefined;
  const environment = firstTrace?.metadata?.environment as string | undefined;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(returnTo, { replace: true })}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
            title="Back to Sessions"
          >
            <BackIcon />
          </button>
          <span className="text-sm font-mono text-accent">{sessionId}</span>
          <CopyButton text={sessionId} />
          {sources.map((source) => (
            <span
              key={source}
              className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded"
            >
              {sourceLabel(source)}
            </span>
          ))}
          {stats.errorCount > 0 ? (
            <span className="text-xs px-1.5 py-0.5 bg-error/10 text-error rounded">
              {stats.errorCount} Error{stats.errorCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
              OK
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sessionId ? (
            <Link
              to={`/dashboard/traces?session_id=${encodeURIComponent(sessionId)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <ExternalLinkIcon />
              View in Traces
            </Link>
          ) : null}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          {/* Stats Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.traceCount}</div>
                <div className="text-xs text-neutral-500">Traces</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.spanCount}</div>
                <div className="text-xs text-neutral-500">Spans</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-lg font-semibold ${
                    stats.errorCount > 0 ? "text-error" : ""
                  }`}
                >
                  {stats.errorCount}
                </div>
                <div className="text-xs text-neutral-500">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.duration}</div>
                <div className="text-xs text-neutral-500">Duration</div>
              </div>
            </div>
            {stats.inputTokens + stats.outputTokens > 0 ||
            stats.costCents > 0 ? (
              <div className="mt-4 flex items-center justify-center gap-8 border-t border-neutral-800 pt-4 text-sm">
                {stats.inputTokens + stats.outputTokens > 0 ? (
                  <span className="text-neutral-400">
                    {(stats.inputTokens + stats.outputTokens).toLocaleString()}{" "}
                    tokens
                    <span className="ml-1 text-xs text-neutral-600">
                      ({stats.inputTokens.toLocaleString()} in /{" "}
                      {stats.outputTokens.toLocaleString()} out)
                    </span>
                  </span>
                ) : null}
                {stats.costCents > 0 ? (
                  <span className="text-neutral-400">
                    {formatCost(stats.costCents)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Metadata */}
          {(user || feature || environment || firstTrace) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {user && (
                  <div>
                    <span className="text-neutral-500">User</span>
                    <div className="font-mono text-xs mt-1">{user}</div>
                  </div>
                )}
                {feature && (
                  <div>
                    <span className="text-neutral-500">Feature</span>
                    <div className="text-xs mt-1">{feature}</div>
                  </div>
                )}
                {firstTrace && (
                  <div>
                    <span className="text-neutral-500">Started</span>
                    <div className="text-xs mt-1">
                      {formatDate(firstTrace.timestamp)}
                    </div>
                  </div>
                )}
                {environment && (
                  <div>
                    <span className="text-neutral-500">Environment</span>
                    <div className="text-xs mt-1">{environment}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Traces Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Traces</h3>
            </div>

            {traces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
                <svg
                  className="w-12 h-12 text-neutral-700 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <h3 className="text-sm font-medium text-neutral-400 mb-1">
                  No traces in this session
                </h3>
                <p className="text-xs text-neutral-500">
                  Traces will appear here once recorded
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline connector line */}
                <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-neutral-800"></div>

                <div className="space-y-2 relative">
                  {traces.map((trace, index) => (
                    <div key={trace.traceId} className="relative pl-6">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-4 w-4 h-4 rounded-full border-2 ${
                          trace.status === "error"
                            ? "bg-error/20 border-error"
                            : "bg-success/20 border-success"
                        }`}
                      ></div>

                      <TraceCard
                        trace={trace}
                        isLatest={index === traces.length - 1}
                        onClick={() =>
                          navigate(`/dashboard/traces/${trace.traceId}`)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
