import { useNavigate } from "react-router-dom";
import type { Trace } from "../../lib/apiClient";
import {
  getProviderBadgeClasses,
  getProviderLabel,
} from "../../lib/providerUtils";

interface RecentTracesTableProps {
  traces: Trace[];
  loading?: boolean;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + "s";
  }
  return Math.round(ms) + "ms";
}

function formatCost(cents: number): string {
  return "$" + (cents / 100).toFixed(4);
}

function formatTokens(
  input?: number,
  output?: number,
): { input: string; output: string } {
  const formatNum = (n: number | undefined) => {
    if (n === undefined) return "-";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toLocaleString();
  };
  return { input: formatNum(input), output: formatNum(output) };
}

function getProviderBadgeColor(provider: string): string {
  const { bg, text } = getProviderBadgeClasses(provider);
  return `${bg} ${text}`;
}

function truncateTraceId(traceId: string): string {
  if (traceId.length <= 12) return traceId;
  return traceId.substring(0, 10) + "...";
}

export function RecentTracesTable({ traces, loading }: RecentTracesTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (traceId: string) => {
    navigate(`/dashboard/traces/${traceId}`);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-neutral-700 rounded-full"></div>
          <span className="text-sm font-medium">Recent Traces</span>
        </div>
        <button
          onClick={() => navigate("/dashboard/traces")}
          className="text-xs text-neutral-400 hover:text-neutral-300"
        >
          View all
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                ID
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Time
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Provider
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Model
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Tokens
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Latency
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Cost
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && traces.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-neutral-500 text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading traces...
                  </div>
                </td>
              </tr>
            ) : traces.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-neutral-500 text-sm"
                >
                  No traces found
                </td>
              </tr>
            ) : (
              traces.map((trace) => {
                const tokens = formatTokens(
                  trace.inputTokens,
                  trace.outputTokens,
                );
                const isError = trace.status === "error";
                return (
                  <tr
                    key={trace.traceId}
                    onClick={() => handleRowClick(trace.traceId)}
                    className={`border-b border-neutral-800 cursor-pointer hover:bg-neutral-850 transition-colors ${isError ? "bg-rose-500/5" : ""}`}
                  >
                    <td className="py-2.5 px-4">
                      <span className="text-sm font-mono text-neutral-400">
                        {truncateTraceId(trace.traceId)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-500">
                        {formatTimeAgo(trace.timestamp)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${getProviderBadgeColor(trace.provider)}`}
                      >
                        {getProviderLabel(trace.provider)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm">
                        {trace.modelUsed || trace.modelRequested}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm">
                        <span className="text-neutral-300">{tokens.input}</span>
                        <span className="text-neutral-600 mx-1">/</span>
                        <span className="text-neutral-500">
                          {tokens.output}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {formatLatency(trace.latencyMs)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {formatCost(trace.costCents)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {isError ? (
                        <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-medium">
                          Error
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
