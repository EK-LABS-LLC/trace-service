import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { Trace } from "../lib/apiClient";
import SessionsTable from "../components/sessions/SessionsTable";
import AgentSessionsTable from "../components/sessions/AgentSessionsTable";
import type { SessionSummary } from "../components/sessions/SessionsTable";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { useAgentSessionsQuery, useTracesQuery } from "../api";
import { useProject } from "../hooks/useProject";
import { summarizeApiAgentSession } from "../lib/agentSessions";

type ViewTab = "llm" | "agents";
type DateRange = "all" | "24h" | "7d" | "30d";
type SessionSort = "recent" | "oldest" | "duration" | "errors" | "volume";

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-3.5 h-3.5 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SortIcon = () => (
  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: "All time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const SORT_LABELS: Record<SessionSort, string> = {
  recent: "Recent activity",
  oldest: "Oldest activity",
  duration: "Duration",
  errors: "Errors",
  volume: "Volume",
};

interface ToolbarMenuProps<T extends string> {
  ariaLabel: string;
  icon: ReactNode;
  prefix?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function ToolbarMenu<T extends string>({
  ariaLabel,
  icon,
  prefix,
  value,
  options,
  onChange,
}: ToolbarMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="group inline-flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-900/80 px-3 text-sm text-neutral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-neutral-700 hover:bg-neutral-850 focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        {icon}
        {prefix ? <span className="text-neutral-500">{prefix}</span> : null}
        <span className="whitespace-nowrap text-neutral-300">{selected?.label}</span>
        <span
          className={`text-neutral-500 transition-transform group-hover:text-neutral-400 ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded border border-neutral-800 bg-neutral-950/95 p-1 shadow-xl shadow-black/30 backdrop-blur"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-neutral-850 text-white"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <span className="whitespace-nowrap">{option.label}</span>
                <span className={active ? "text-accent" : "text-transparent"}>
                  <CheckIcon />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function validTab(value: string | null): ViewTab {
  return value === "agents" ? "agents" : "llm";
}

function validRange(value: string | null): DateRange {
  return value === "24h" || value === "7d" || value === "30d" ? value : "all";
}

function validSort(value: string | null): SessionSort {
  return value === "oldest" || value === "duration" || value === "errors" || value === "volume"
    ? value
    : "recent";
}

function getDateRangeParams(range: DateRange): { date_from?: string; date_to?: string } {
  if (range === "all") return {};

  const from = new Date();
  if (range === "24h") {
    from.setHours(from.getHours() - 24);
  } else if (range === "7d") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }

  return { date_from: from.toISOString() };
}

function groupTracesIntoSessions(traces: Trace[]): SessionSummary[] {
  const sessionMap = new Map<string, Trace[]>();

  for (const trace of traces) {
    if (!trace.sessionId) continue;
    const existing = sessionMap.get(trace.sessionId) || [];
    existing.push(trace);
    sessionMap.set(trace.sessionId, existing);
  }

  const sessions: SessionSummary[] = [];
  for (const [session_id, sessionTraces] of sessionMap) {
    const sorted = sessionTraces.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const totalTokens = sorted.reduce(
      (sum, t) => sum + (t.inputTokens || 0) + (t.outputTokens || 0),
      0
    );
    const totalCost = sorted.reduce((sum, t) => sum + (t.costCents || 0), 0);
    const errorCount = sorted.filter((t) => t.status === "error").length;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;

    sessions.push({
      session_id,
      first_trace_time: first.timestamp,
      last_trace_time: last.timestamp,
      trace_count: sorted.length,
      total_tokens: totalTokens,
      total_cost_cents: totalCost,
      error_count: errorCount,
      user: first.metadata?.user as string | undefined,
    });
  }

  return sessions.sort(
    (a, b) => new Date(b.first_trace_time).getTime() - new Date(a.first_trace_time).getTime()
  );
}

export default function Sessions() {
  const { selectedProject } = useProject();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const activeTab = validTab(searchParams.get("tab"));
  const dateRange = validRange(searchParams.get("range"));
  const sort = validSort(searchParams.get("sort"));
  const dateParams = useMemo(() => getDateRangeParams(dateRange), [dateRange]);

  const updateSearchParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const selectTab = (tab: ViewTab) => {
    updateSearchParam("tab", tab === "agents" ? "agents" : null);
  };

  const selectDateRange = (range: DateRange) => {
    updateSearchParam("range", range === "all" ? null : range);
  };

  const selectSort = (nextSort: SessionSort) => {
    updateSearchParam("sort", nextSort === "recent" ? null : nextSort);
  };

  // LLM sessions (from traces)
  const sessionsQuery = useTracesQuery("sessions-source-traces", selectedProject?.id, {
    limit: 500,
    ...dateParams,
  });

  const agentSessionsQuery = useAgentSessionsQuery(
    "sessions-source-agent-sessions",
    selectedProject?.id,
    {
      limit: 500,
      sort,
      ...dateParams,
    }
  );

  const llmSessions = groupTracesIntoSessions(sessionsQuery.data?.traces ?? []);
  const agentSessions = agentSessionsQuery.data?.sessions.map(summarizeApiAgentSession) ?? [];

  const llmLoading = sessionsQuery.isPending;
  const agentLoading = agentSessionsQuery.isPending;
  const llmError = sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null;
  const agentError =
    agentSessionsQuery.error instanceof Error ? agentSessionsQuery.error.message : null;

  const searchedLlmSessions = searchQuery
    ? llmSessions.filter(
        (s) =>
          s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.user && s.user.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : llmSessions;

  const filteredLlmSessions = [...searchedLlmSessions].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.first_trace_time).getTime() - new Date(b.first_trace_time).getTime();
      case "duration":
        return (
          new Date(b.last_trace_time).getTime() -
          new Date(b.first_trace_time).getTime() -
          (new Date(a.last_trace_time).getTime() - new Date(a.first_trace_time).getTime())
        );
      case "errors":
        return b.error_count - a.error_count;
      case "volume":
        return b.trace_count - a.trace_count;
      case "recent":
      default:
        return new Date(b.last_trace_time).getTime() - new Date(a.last_trace_time).getTime();
    }
  });

  const filteredAgentSessions = searchQuery
    ? agentSessions.filter((s) => {
        const query = searchQuery.toLowerCase();
        return [
          s.displayName,
          s.subtitle,
          s.sessionId,
          s.shortId,
          s.sourceLabel,
          s.cwd,
          s.model,
          s.firstPrompt,
        ].some((value) => value?.toLowerCase().includes(query));
      })
    : agentSessions;

  const total =
    activeTab === "llm"
      ? llmSessions.length
      : (agentSessionsQuery.data?.total ?? agentSessions.length);
  const error = activeTab === "llm" ? llmError : agentError;
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">Sessions</h1>
          {/* Tab Switcher */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-sm p-0.5">
            <button
              onClick={() => selectTab("llm")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                activeTab === "llm"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              LLM
            </button>
            <button
              onClick={() => selectTab("agents")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                activeTab === "agents"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Agents
            </button>
          </div>
          <span className="text-xs text-neutral-500">{total.toLocaleString()} total</span>
        </div>
        <div className="flex items-center gap-3">
          <ToolbarMenu
            ariaLabel="Date range"
            icon={<CalendarIcon />}
            value={dateRange}
            options={(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => ({
              value: range,
              label: DATE_RANGE_LABELS[range],
            }))}
            onChange={selectDateRange}
          />
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-neutral-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Live
          </div>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded">
              <SearchIcon />
              <input
                type="text"
                placeholder={
                  activeTab === "agents"
                    ? "Search by name, folder, model, or session ID..."
                    : "Search by session ID or user..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-neutral-300 placeholder:text-neutral-500 outline-none"
              />
            </div>
          </div>
          <ToolbarMenu
            ariaLabel="Sort sessions"
            icon={<SortIcon />}
            prefix="Sort:"
            value={sort}
            options={(Object.keys(SORT_LABELS) as SessionSort[]).map((sortOption) => ({
              value: sortOption,
              label: SORT_LABELS[sortOption],
            }))}
            onChange={selectSort}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded">
            <div className="flex items-center justify-between gap-4">
              <p className="text-rose-400 text-sm">{error}</p>
              <button
                onClick={() => {
                  if (activeTab === "llm") sessionsQuery.refetch();
                  else agentSessionsQuery.refetch();
                }}
                className="text-sm text-accent hover:underline whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!error && activeTab === "llm" && (
          <>
            {llmLoading ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                  <TableSkeleton rows={10} columns={7} />
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <SessionsTable sessions={filteredLlmSessions} />
              </div>
            )}
          </>
        )}

        {!error && activeTab === "agents" && (
          <>
            {agentLoading ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                  <TableSkeleton rows={10} columns={6} />
                </div>
              </div>
            ) : filteredAgentSessions.length === 0 ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-neutral-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-neutral-300 mb-2">No Agent Sessions</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Agent sessions with span data will appear here when available.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <AgentSessionsTable sessions={filteredAgentSessions} returnTo={returnTo} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
