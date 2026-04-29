import { useNavigate } from "react-router-dom";

interface AgentSessionSummary {
  sessionId: string;
  timestamp: string;
  status: "success" | "error";
  durationMs: number;
  agentRuns: number;
  toolCalls: number;
}

interface AgentSessionsTableProps {
  sessions: AgentSessionSummary[];
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

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return id.substring(0, 12) + "...";
}

export default function AgentSessionsTable({
  sessions,
}: AgentSessionsTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (sessionId: string) => {
    navigate(`/dashboard/sessions/${sessionId}?view=agents`);
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded p-8 text-center">
        <p className="text-sm text-neutral-500">No agent sessions found</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Session ID
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Time
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Duration
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Agent Runs
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Tool Calls
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              onClick={() => handleRowClick(session.sessionId)}
              className="border-b border-neutral-800 cursor-pointer hover:bg-neutral-850 transition-colors"
            >
              <td className="py-3 px-4">
                <span className="text-sm font-mono text-neutral-300">
                  {truncateId(session.sessionId)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-500">
                  {formatTimeAgo(session.timestamp)}
                </span>
              </td>
              <td className="py-3 px-4">
                {session.status === "error" ? (
                  <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-medium">
                    Error
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium">
                    OK
                  </span>
                )}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {formatDuration(session.durationMs)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {session.agentRuns}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {session.toolCalls}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
