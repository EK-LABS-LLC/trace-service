import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import SessionsTable from "../components/sessions/SessionsTable";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { useAgentSessionsQuery } from "../api";
import { useProject } from "../hooks/useProject";
import { summarizeApiAgentSession } from "../lib/agentSessions";

type DateRange = "all" | "24h" | "7d" | "30d";
type SessionSort = "recent" | "oldest" | "duration" | "errors" | "volume";
type PageSize = 25 | 50 | 100;
type SourceFilter =
  "" | "claude_code" | "codex" | "opencode" | "openclaw" | "sdk";

const CalendarIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const FilterIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.586L3.293 6.707A1 1 0 013 6V4z"
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
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const SortIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="h-3.5 w-3.5"
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

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  "": "All sources",
  claude_code: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  sdk: "SDK",
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
  const selected =
    options.find((option) => option.value === value) ?? options[0];

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
        <span className="whitespace-nowrap text-neutral-300">
          {selected?.label}
        </span>
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

function validRange(value: string | null): DateRange {
  return value === "24h" || value === "7d" || value === "30d" ? value : "all";
}

function validSort(value: string | null): SessionSort {
  return value === "oldest" ||
    value === "duration" ||
    value === "errors" ||
    value === "volume"
    ? value
    : "recent";
}

function validSourceFilter(value: string | null): SourceFilter {
  return value === "claude_code" ||
    value === "codex" ||
    value === "opencode" ||
    value === "openclaw" ||
    value === "sdk"
    ? value
    : "";
}

function validPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function validPageSize(value: string | null): PageSize {
  const parsed = Number.parseInt(value ?? "", 10);
  return parsed === 25 || parsed === 100 ? parsed : 50;
}

function getDateRangeParams(range: DateRange): {
  date_from?: string;
  date_to?: string;
} {
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

export default function Sessions() {
  const { selectedProject } = useProject();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const dateRange = validRange(searchParams.get("range"));
  const sort = validSort(searchParams.get("sort"));
  const source = validSourceFilter(searchParams.get("source"));
  const page = validPage(searchParams.get("page"));
  const pageSize = validPageSize(searchParams.get("pageSize"));
  const dateParams = useMemo(() => getDateRangeParams(dateRange), [dateRange]);

  useEffect(() => {
    if (!searchParams.has("tab")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const selectDateRange = (range: DateRange) => {
    updateSearchParams({
      range: range === "all" ? null : range,
      page: null,
    });
  };

  const selectSort = (nextSort: SessionSort) => {
    updateSearchParams({
      sort: nextSort === "recent" ? null : nextSort,
      page: null,
    });
  };

  const selectSource = (nextSource: SourceFilter) => {
    updateSearchParams({ source: nextSource || null, page: null });
  };

  const sessionsQuery = useAgentSessionsQuery(
    "sessions-list",
    selectedProject?.id,
    {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort,
      source: source || undefined,
      ...dateParams,
    },
  );

  const sessions =
    sessionsQuery.data?.sessions.map(summarizeApiAgentSession) ?? [];
  const total = sessionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const loading = sessionsQuery.isPending;
  const error =
    sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null;

  useEffect(() => {
    if (loading || page <= totalPages) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const next = new URLSearchParams(searchParams);
      if (totalPages === 1) next.delete("page");
      else next.set("page", String(totalPages));
      setSearchParams(next, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, page, searchParams, setSearchParams, totalPages]);

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return [
      s.displayName,
      s.subtitle,
      s.sessionId,
      s.shortId,
      s.sourceLabel,
      s.cwd,
      s.model,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">Sessions</h1>
          <span className="text-xs text-neutral-500">
            {(searchQuery ? filteredSessions.length : total).toLocaleString()}{" "}
            total
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ToolbarMenu
            ariaLabel="Source"
            icon={<FilterIcon />}
            prefix="Source:"
            value={source}
            options={(Object.keys(SOURCE_FILTER_LABELS) as SourceFilter[]).map(
              (value) => ({
                value,
                label: SOURCE_FILTER_LABELS[value],
              }),
            )}
            onChange={selectSource}
          />
          <ToolbarMenu
            ariaLabel="Date range"
            icon={<CalendarIcon />}
            value={dateRange}
            options={(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(
              (range) => ({
                value: range,
                label: DATE_RANGE_LABELS[range],
              }),
            )}
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
                placeholder="Filter this page by name, folder, model, or session ID..."
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
            options={(Object.keys(SORT_LABELS) as SessionSort[]).map(
              (sortOption) => ({
                value: sortOption,
                label: SORT_LABELS[sortOption],
              }),
            )}
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
                onClick={() => sessionsQuery.refetch()}
                className="text-sm text-accent hover:underline whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!error &&
          (loading ? (
            <div className="max-w-7xl mx-auto">
              <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                <TableSkeleton rows={10} columns={9} />
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="max-w-7xl mx-auto">
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
                <h3 className="text-sm font-medium text-neutral-300 mb-2">
                  No Sessions
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Sessions with span data will appear here when available.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              <SessionsTable sessions={filteredSessions} returnTo={returnTo} />
              <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <span>
                    {startItem.toLocaleString()}–{endItem.toLocaleString()} of{" "}
                    {total.toLocaleString()}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(event) =>
                      updateSearchParams({
                        pageSize:
                          event.target.value === "50"
                            ? null
                            : event.target.value,
                        page: null,
                      })
                    }
                    className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-400 outline-none"
                    aria-label="Sessions per page"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      updateSearchParams({
                        page: page - 1 === 1 ? null : String(page - 1),
                      })
                    }
                    className="rounded border border-neutral-800 px-2.5 py-1.5 text-neutral-400 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page.toLocaleString()} of{" "}
                    {totalPages.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      updateSearchParams({ page: String(page + 1) })
                    }
                    className="rounded border border-neutral-800 px-2.5 py-1.5 text-neutral-400 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
