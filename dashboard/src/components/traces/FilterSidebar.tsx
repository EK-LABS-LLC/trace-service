import type { TracesFilters } from "../../pages/Traces";

interface FilterSidebarProps {
  filters: TracesFilters;
  onApplyFilters: (filters: TracesFilters) => void;
  onClearFilters: () => void;
}

export default function FilterSidebar({
  filters,
  onApplyFilters,
  onClearFilters,
}: FilterSidebarProps) {
  const updateFilter = (key: keyof TracesFilters, value: string) => {
    onApplyFilters({ ...filters, [key]: value });
  };

  return (
    <aside className="w-64 border-r border-neutral-800 flex-shrink-0 overflow-y-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Filters
          </h2>
          <button
            onClick={onClearFilters}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear all
          </button>
        </div>

        {/* Provider Filter */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">
            Provider
          </label>
          <select
            value={filters.provider}
            onChange={(e) => updateFilter("provider", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
          >
            <option value="">All providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openrouter">OpenRouter</option>
            <option value="google">Google</option>
            <option value="meta">Meta</option>
            <option value="mistral">Mistral</option>
            <option value="cohere">Cohere</option>
          </select>
        </div>

        {/* Model Filter */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">Model</label>
          <input
            type="text"
            value={filters.model}
            onChange={(e) => updateFilter("model", e.target.value)}
            placeholder="e.g., gpt-4-turbo"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">
            Date from
          </label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">
            Date to
          </label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
          />
        </div>

        {/* Session ID */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">
            Session ID
          </label>
          <input
            type="text"
            value={filters.session_id}
            onChange={(e) => updateFilter("session_id", e.target.value)}
            placeholder="e.g., ses_abc123"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>
    </aside>
  );
}
