import { useNavigate } from "react-router-dom";

interface SessionSummary {
  sessionId: string;
  timestamp: string;
  status: "success" | "error" | "running";
  durationMs: number;
  agentRuns: number;
  toolCalls: number;
  totalTokens: number;
  costCents: number;
  agentName?: string;
}

interface RecentSessionsTableProps {
  sessions: SessionSummary[];
  loading?: boolean;
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
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

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + "K";
  }
  return String(count);
}

function formatCost(cents: number): string {
  if (cents >= 100) {
    return "$" + (cents / 100).toFixed(2);
  }
  return "$" + (cents / 100).toFixed(3);
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return id.substring(0, 8) + "...";
}

export function RecentSessionsTable({
  sessions,
  loading,
}: RecentSessionsTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (sessionId: string) => {
    navigate(`/dashboard/sessions/${sessionId}`);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-neutral-700 rounded-full"></div>
          <span className="text-sm font-medium">Recent Sessions</span>
        </div>
        <button
          onClick={() => navigate("/dashboard/sessions")}
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
                Status
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Duration
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Runs
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Tools
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Tokens
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && sessions.length === 0 ? (
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
                    Loading sessions...
                  </div>
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-neutral-500 text-sm"
                >
                  No sessions found
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const isError = session.status === "error";
                return (
                  <tr
                    key={session.sessionId}
                    onClick={() => handleRowClick(session.sessionId)}
                    className={`border-b border-neutral-800 cursor-pointer hover:bg-neutral-850 transition-colors ${isError ? "bg-rose-500/5" : ""}`}
                  >
                    <td className="py-2.5 px-4">
                      <span className="text-sm font-mono text-neutral-400">
                        {truncateId(session.sessionId)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-500">
                        {formatTimeAgo(session.timestamp)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {isError ? (
                        <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-medium">
                          Error
                        </span>
                      ) : session.status === "running" ? (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded font-medium">
                          Running
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {formatDuration(session.durationMs)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {session.agentRuns}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {session.toolCalls}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {formatTokens(session.totalTokens)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-sm text-neutral-300">
                        {formatCost(session.costCents)}
                      </span>
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
