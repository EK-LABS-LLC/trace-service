interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?:
    | "emerald"
    | "blue"
    | "purple"
    | "amber"
    | "rose"
    | "cyan"
    | "indigo"
    | "violet";
  change?: {
    value: string;
    positive: boolean;
  };
  subtitle?: string;
}

const colorClasses = {
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
  },
  blue: {
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-400",
  },
  purple: {
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-400",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
  },
  rose: {
    iconBg: "bg-rose-500/10",
    iconText: "text-rose-400",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-400",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-400",
  },
};

export function StatCard({
  label,
  value,
  icon,
  color,
  change,
  subtitle,
}: StatCardProps) {
  const colors = color ? colorClasses[color] : null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 transition-colors hover:border-neutral-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-sm flex items-center justify-center ${colors ? colors.iconBg : "bg-neutral-800"}`}
          >
            <span className={colors ? colors.iconText : "text-neutral-400"}>
              {icon}
            </span>
          </div>
          <span className="text-xs text-neutral-500 uppercase tracking-wide">
            {label}
          </span>
        </div>
        {change && (
          <span
            className={`text-xs font-medium ${
              change.positive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {change.positive ? "+" : ""}
            {change.value}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {subtitle && (
        <div className="mt-1.5 text-xs text-neutral-500">{subtitle}</div>
      )}
    </div>
  );
}
