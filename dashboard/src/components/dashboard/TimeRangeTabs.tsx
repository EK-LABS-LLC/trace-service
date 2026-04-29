export type TimeRange = "24h" | "7d" | "30d";

interface TimeRangeTabsProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const tabs: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function TimeRangeTabs({ value, onChange }: TimeRangeTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-neutral-850 p-0.5 rounded">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
            value === tab.value
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
