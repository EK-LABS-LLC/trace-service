import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Trace } from "../../lib/apiClient";

interface TraceDetailPanelProps {
  trace: Trace | null;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const CloseIcon = () => (
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
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const ChevronLeftIcon = () => (
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
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

const ChevronRightIcon = () => (
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
      d="M9 5l7 7-7 7"
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

const CopyIcon = () => (
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
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const formatLatency = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatCost = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "--";
  return `$${(cents / 100).toFixed(4)}`;
};

const formatTokens = (tokens: number | null | undefined) => {
  if (tokens === null || tokens === undefined) return 0;
  return tokens;
};

const extractMessagePreview = (
  body: unknown,
  type: "input" | "output",
): string => {
  if (!body || typeof body !== "object") return "";

  const obj = body as Record<string, unknown>;

  if (type === "input") {
    // Try to get the last user message or system message
    if (Array.isArray(obj.messages)) {
      const messages = obj.messages as Array<{
        role?: string;
        content?: string;
      }>;
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage?.content) return lastUserMessage.content;
      const systemMessage = messages.find((m) => m.role === "system");
      if (systemMessage?.content) return systemMessage.content;
    }
    // Fallback: stringify
    return JSON.stringify(body).slice(0, 200);
  }

  if (type === "output") {
    // Try to get the assistant's response
    if (Array.isArray(obj.choices)) {
      const choices = obj.choices as Array<{
        message?: { content?: string };
        text?: string;
      }>;
      if (choices[0]?.message?.content) return choices[0].message.content;
      if (choices[0]?.text) return choices[0].text;
    }
    // Anthropic format
    if (Array.isArray(obj.content)) {
      const content = obj.content as Array<{ text?: string }>;
      if (content[0]?.text) return content[0].text;
    }
    return JSON.stringify(body).slice(0, 200);
  }

  return "";
};

export default function TraceDetailPanel({
  trace,
  onClose,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: TraceDetailPanelProps) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!trace) return null;

  const isError = trace.status === "error";
  const totalTokens = (trace.inputTokens || 0) + (trace.outputTokens || 0);
  const inputPercent =
    totalTokens > 0 ? ((trace.inputTokens || 0) / totalTokens) * 100 : 0;
  const outputPercent =
    totalTokens > 0 ? ((trace.outputTokens || 0) / totalTokens) * 100 : 0;

  const inputPreview = extractMessagePreview(trace.requestBody, "input");
  const outputPreview = isError
    ? typeof trace.error === "string"
      ? trace.error
      : JSON.stringify(trace.error || {})
    : extractMessagePreview(trace.responseBody, "output");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openInNewTab = () => {
    navigate(`/dashboard/traces/${trace.traceId}`);
  };

  const viewSession = () => {
    if (trace.sessionId) {
      navigate(`/dashboard/sessions/${trace.sessionId}`);
    }
  };

  return (
    <aside className="absolute inset-y-0 right-0 w-[420px] border-l border-neutral-800 bg-neutral-925 shadow-2xl flex flex-col z-10">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-accent">
            {trace.traceId.slice(0, 12)}
          </span>
          {isError ? (
            <span className="text-xs px-1.5 py-0.5 bg-error/10 text-error rounded">
              ERR
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
              OK
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate("prev")}
                disabled={!hasPrev}
                className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                title="Previous"
              >
                <ChevronLeftIcon />
              </button>
              <button
                onClick={() => onNavigate("next")}
                disabled={!hasNext}
                className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                title="Next"
              >
                <ChevronRightIcon />
              </button>
            </>
          )}
          <button
            onClick={openInNewTab}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white"
            title="Open in new tab"
          >
            <ExternalLinkIcon />
          </button>
          <div className="w-px h-4 bg-neutral-700 mx-1"></div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3 text-center">
              <div className="text-xs text-neutral-500 mb-1">Latency</div>
              <div className="text-sm font-medium">
                {formatLatency(trace.latencyMs)}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3 text-center">
              <div className="text-xs text-neutral-500 mb-1">Tokens</div>
              <div className="text-sm font-medium">
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3 text-center">
              <div className="text-xs text-neutral-500 mb-1">Cost</div>
              <div className="text-sm font-medium">
                {formatCost(trace.costCents)}
              </div>
            </div>
          </div>

          {/* Model Info */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
              Model
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Provider</span>
                <span className="capitalize">{trace.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Requested</span>
                <span>{trace.modelRequested}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Used</span>
                <span className="text-xs font-mono">{trace.modelUsed}</span>
              </div>
              {trace.finishReason && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Finish Reason</span>
                  <span>{trace.finishReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tokens */}
          {totalTokens > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                Tokens
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-500">Input</span>
                    <span>
                      {formatTokens(trace.inputTokens).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded">
                    <div
                      className="bg-accent h-1.5 rounded"
                      style={{ width: `${inputPercent}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-500">Output</span>
                    <span>
                      {formatTokens(trace.outputTokens).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded">
                    <div
                      className="bg-neutral-400 h-1.5 rounded"
                      style={{ width: `${outputPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Preview */}
          {inputPreview && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-500 uppercase tracking-wide">
                  Input
                </span>
                <button
                  onClick={openInNewTab}
                  className="text-xs text-accent/60 hover:text-accent"
                >
                  View full
                </button>
              </div>
              <div className="text-sm text-neutral-300 line-clamp-3">
                {inputPreview}
              </div>
            </div>
          )}

          {/* Output Preview / Error */}
          {outputPreview && (
            <div
              className={`bg-neutral-900 border rounded p-3 ${isError ? "border-error/30" : "border-neutral-800"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs uppercase tracking-wide ${isError ? "text-error" : "text-neutral-500"}`}
                >
                  {isError ? "Error" : "Output"}
                </span>
                <button
                  onClick={openInNewTab}
                  className="text-xs text-accent/60 hover:text-accent"
                >
                  View full
                </button>
              </div>
              <div
                className={`text-sm line-clamp-3 ${isError ? "text-error/80" : "text-neutral-300"}`}
              >
                {outputPreview}
              </div>
            </div>
          )}

          {/* Session Link */}
          {trace.sessionId && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                Session
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-accent/80">
                  {trace.sessionId.slice(0, 12)}...
                </span>
                <button
                  onClick={viewSession}
                  className="text-xs text-accent/60 hover:text-accent"
                >
                  View session
                </button>
              </div>
            </div>
          )}

          {/* Metadata */}
          {trace.metadata && Object.keys(trace.metadata).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                Metadata
              </div>
              <div className="space-y-1.5 text-sm">
                {Object.entries(trace.metadata)
                  .slice(0, 5)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-neutral-500">{key}</span>
                      <span
                        className="font-mono text-xs truncate max-w-[180px]"
                        title={String(value)}
                      >
                        {String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => copyToClipboard(trace.traceId)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-neutral-400 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors"
            >
              <CopyIcon />
              Copy ID
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
