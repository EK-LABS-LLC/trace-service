interface ToolUsageItem {
  name: string;
  count: number;
}

interface ToolUsageChartProps {
  data: ToolUsageItem[];
  maxItems?: number;
}

// Gradient colors for the bars
const BAR_COLORS = [
  "bg-gradient-to-r from-violet-500/80 to-violet-600/80",
  "bg-gradient-to-r from-blue-500/80 to-blue-600/80",
  "bg-gradient-to-r from-cyan-500/80 to-cyan-600/80",
  "bg-gradient-to-r from-emerald-500/80 to-emerald-600/80",
  "bg-gradient-to-r from-amber-500/80 to-amber-600/80",
];

export default function ToolUsageChart({
  data,
  maxItems = 5,
}: ToolUsageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-neutral-500">
        <p className="text-sm">No tool usage data</p>
      </div>
    );
  }

  const sortedData = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
  const maxCount = Math.max(...sortedData.map((d) => d.count));

  return (
    <div className="space-y-3.5">
      {sortedData.map((tool, index) => {
        const percentage = (tool.count / maxCount) * 100;
        const barColor = BAR_COLORS[index % BAR_COLORS.length];
        return (
          <div key={tool.name} className="flex items-center gap-3">
            <div className="w-16 text-xs text-neutral-300 font-medium truncate">
              {tool.name}
            </div>
            <div className="flex-1 h-5 bg-neutral-800/50 rounded-sm overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-sm transition-all duration-500 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="w-10 text-xs text-neutral-400 text-right font-medium">
              {tool.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}
