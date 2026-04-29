import { Link } from "react-router-dom";
import type { Trace } from "../../lib/apiClient";

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms}ms`;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(4)}`;
}

interface TraceMetadataProps {
  trace: Trace;
}

export default function TraceMetadata({ trace }: TraceMetadataProps) {
  const totalTokens = (trace.inputTokens || 0) + (trace.outputTokens || 0);
  const items = [
    { label: "Latency", value: formatLatency(trace.latencyMs) },
    {
      label: "Input Tokens",
      value: trace.inputTokens?.toLocaleString() ?? "--",
    },
    {
      label: "Output Tokens",
      value: trace.outputTokens?.toLocaleString() ?? "--",
    },
    {
      label: "Total Tokens",
      value: totalTokens > 0 ? totalTokens.toLocaleString() : "--",
    },
    { label: "Cost", value: formatCost(trace.costCents) },
    { label: "Finish Reason", value: trace.finishReason ?? "--" },
    {
      label: "Session ID",
      value: trace.sessionId ?? "--",
      isSessionLink: !!trace.sessionId,
    },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs text-neutral-500 uppercase tracking-wide mb-4">
        Details
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {items.map(({ label, value, isSessionLink }) => (
          <div key={label}>
            <dt className="text-xs text-neutral-500 mb-1">{label}</dt>
            {isSessionLink && trace.sessionId ? (
              <Link
                to={`/dashboard/sessions/${trace.sessionId}`}
                className="text-sm font-mono text-accent hover:underline"
              >
                {value}
              </Link>
            ) : (
              <dd className="text-sm text-neutral-100">{value}</dd>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
