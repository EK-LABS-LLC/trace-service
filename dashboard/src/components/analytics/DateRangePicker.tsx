import { useState, useRef, useEffect } from "react";

export type DateRangePreset = "24h" | "7d" | "30d" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

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

function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

function getPresetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "custom":
      return "Custom range";
  }
}

function getPresetDates(preset: DateRangePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = now;
  let from: Date;

  switch (preset) {
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { from, to };
}

export default function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.preset === "custom");
  const [customFrom, setCustomFrom] = useState(formatDateForInput(value.from));
  const [customTo, setCustomTo] = useState(formatDateForInput(value.to));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }

    const { from, to } = getPresetDates(preset);
    onChange({ preset, from, to });
    setShowCustom(false);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;

    const from = new Date(customFrom);
    const to = new Date(customTo);

    // Set time to start/end of day
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    onChange({ preset: "custom", from, to });
    setIsOpen(false);
  };

  const presets: { value: DateRangePreset; label: string }[] = [
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
  ];

  const displayLabel =
    value.preset === "custom" && value.from && value.to
      ? `${value.from.toLocaleDateString()} - ${value.to.toLocaleDateString()}`
      : getPresetLabel(value.preset);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors"
      >
        <CalendarIcon />
        <span>{displayLabel}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-10">
          {/* Preset Buttons */}
          <div className="p-2 border-b border-neutral-800">
            <div className="flex gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    value.preset === preset.value && !showCustom
                      ? "bg-accent text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-850"
                  }`}
                >
                  {preset.value}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Toggle */}
          <div className="p-2 border-b border-neutral-800">
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                showCustom
                  ? "text-white bg-neutral-850"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-850"
              }`}
            >
              Custom range
            </button>
          </div>

          {/* Custom Date Inputs */}
          {showCustom && (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={handleApplyCustom}
                disabled={!customFrom || !customTo}
                className="w-full px-3 py-1.5 text-sm font-medium text-white bg-accent rounded hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          )}

          {/* Quick presets list (when not showing custom) */}
          {!showCustom && (
            <div className="py-1">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    value.preset === preset.value
                      ? "text-white bg-neutral-850"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-850"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
