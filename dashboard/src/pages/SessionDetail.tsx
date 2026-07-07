import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { OTelTraceSummary } from "../lib/apiClient";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useOTelSessionTracesQuery } from "../api";
import { useProject } from "../hooks/useProject";

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0ms";
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 10)}...` : id;
}

function attributeString(
  attributes: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = attributes?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function attributeNumber(
  attributes: Record<string, unknown> | null | undefined,
  key: string,
): number {
  const value = attributes?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
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
      type="button"
      onClick={handleCopy}
      className={`p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function TraceRow({ trace, onClick }: { trace: OTelTraceSummary; onClick: () => void }) {
  const isError = trace.status === "error";
  const tokens = trace.inputTokens + trace.outputTokens;
  const displayName =
    attributeString(trace.attributes, "pulse.display.name") ||
    attributeString(trace.attributes, "pulse.trace.name") ||
    trace.name;
  const promptPreview = attributeString(trace.attributes, "pulse.prompt.preview");
  const sessionName = attributeString(trace.attributes, "pulse.session.name");
  const provider = attributeString(trace.attributes, "gen_ai.provider.name");
  const model = attributeString(trace.attributes, "gen_ai.request.model");
  const agentRuns = attributeNumber(trace.attributes, "pulse.agent_run_count");
  const toolCalls = attributeNumber(trace.attributes, "pulse.tool_call_count");
  const modelLabel =
    provider && model ? `${provider}/${model}` : model || provider || trace.source;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded border p-4 text-left transition-colors ${
        isError
          ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
          : "border-neutral-800 bg-neutral-900 hover:bg-neutral-850"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isError ? "bg-rose-400" : "bg-emerald-400"}`} />
            <span className="truncate text-sm font-medium text-neutral-100" title={displayName}>
              {displayName}
            </span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">
              {trace.source}
            </span>
          </div>
          {promptPreview && promptPreview !== displayName ? (
            <div className="mt-1 max-w-2xl truncate text-xs text-neutral-400" title={promptPreview}>
              {promptPreview}
            </div>
          ) : null}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            {sessionName ? <span className="truncate max-w-[220px]">{sessionName}</span> : null}
            <span className="truncate max-w-[240px]">{modelLabel}</span>
            <span className="font-mono" title={trace.traceId}>
              {shortId(trace.traceId)}
            </span>
            <span>{formatDate(trace.startedAt)}</span>
            {agentRuns > 0 ? <span>{agentRuns} agent run{agentRuns === 1 ? "" : "s"}</span> : null}
            {toolCalls > 0 ? <span>{toolCalls} tool call{toolCalls === 1 ? "" : "s"}</span> : null}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 text-right text-xs">
          <div>
            <div className="text-sm text-neutral-200">{trace.spanCount}</div>
            <div className="text-neutral-500">spans</div>
          </div>
          <div>
            <div className="text-sm text-neutral-200">{formatDuration(trace.durationMs)}</div>
            <div className="text-neutral-500">duration</div>
          </div>
          <div>
            <div className="text-sm text-neutral-200">{formatTokens(tokens)}</div>
            <div className="text-neutral-500">tokens</div>
          </div>
          <div>
            <div className="text-sm text-neutral-200">{formatCost(trace.costCents)}</div>
            <div className="text-neutral-500">cost</div>
          </div>
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

  const tracesQuery = useOTelSessionTracesQuery("otel-session-traces", selectedProject?.id, id, {
    limit: 1000,
    sort: "recent",
  });

  const traces = useMemo(
    () =>
      [...(tracesQuery.data?.traces ?? [])].sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      ),
    [tracesQuery.data?.traces]
  );

  const error = tracesQuery.error instanceof Error ? tracesQuery.error.message : null;
  const loading = tracesQuery.isPending;
  const sessionId = id ?? "";
  const totalSpans = traces.reduce((sum, trace) => sum + trace.spanCount, 0);
  const totalTokens = traces.reduce((sum, trace) => sum + trace.inputTokens + trace.outputTokens, 0);
  const totalCost = traces.reduce((sum, trace) => sum + trace.costCents, 0);
  const errorCount = traces.reduce((sum, trace) => sum + trace.errorCount, 0);
  const firstTrace = traces[0];
  const lastTrace = traces[traces.length - 1];
  const durationMs =
    firstTrace && lastTrace
      ? new Date(lastTrace.endedAt).getTime() - new Date(firstTrace.startedAt).getTime()
      : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner text="Loading session traces..." />
      </div>
    );
  }

  if (error) {
    const notFound = error.toLowerCase().includes("not found") || error.includes("404");
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-neutral-100 mb-2">
            {notFound ? "Session not found" : "Could not load session"}
          </h1>
          <p className="text-neutral-500 mb-6">{error}</p>
          {notFound ? (
            <Link to={returnTo} className="text-accent hover:underline">
              Back to Sessions
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => tracesQuery.refetch()}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnTo, { replace: true })}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
            title="Back to Sessions"
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-100">Session</div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="truncate font-mono" title={sessionId}>
                {sessionId}
              </span>
              <CopyButton text={sessionId} />
            </div>
          </div>
          {errorCount > 0 ? (
            <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded">
              {errorCount} Error{errorCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
              OK
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded p-5 mb-6">
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{traces.length}</div>
                <div className="text-xs text-neutral-500">Traces</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{totalSpans}</div>
                <div className="text-xs text-neutral-500">Spans</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{formatTokens(totalTokens)}</div>
                <div className="text-xs text-neutral-500">Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-accent">{formatCost(totalCost)}</div>
                <div className="text-xs text-neutral-500">Cost</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{formatDuration(durationMs)}</div>
                <div className="text-xs text-neutral-500">Duration</div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Traces</h3>
            <span className="text-xs text-neutral-500">
              Each row is one OTel trace grouped by trace_id
            </span>
          </div>

          {traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-900 border border-neutral-800 rounded">
              <h3 className="text-sm font-medium text-neutral-400 mb-1">No traces in this session</h3>
              <p className="text-xs text-neutral-500">Traces will appear here once spans are recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {traces.map((trace) => (
                <TraceRow
                  key={trace.traceId}
                  trace={trace}
                  onClick={() =>
                    navigate(`/dashboard/traces/${encodeURIComponent(trace.traceId)}`, {
                      state: { returnTo: `${location.pathname}${location.search}` },
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
