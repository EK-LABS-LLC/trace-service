import { useState } from "react";

interface JsonViewerProps {
  data: unknown;
  title: string;
}

const CopyIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function JsonNode({
  keyName,
  value,
  depth = 0,
}: {
  keyName?: string;
  value: JsonValue;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const getValueColor = (val: JsonValue): string => {
    if (val === null) return "text-neutral-500";
    if (typeof val === "string") return "text-emerald-400";
    if (typeof val === "number") return "text-amber-400";
    if (typeof val === "boolean") return "text-purple-400";
    return "text-neutral-100";
  };

  const renderValue = (val: JsonValue) => {
    if (val === null) return "null";
    if (typeof val === "string") return `"${val}"`;
    return String(val);
  };

  const indent = depth * 16;

  if (isExpandable) {
    const entries = isArray
      ? value.map((v, i) => [i, v] as [number, JsonValue])
      : Object.entries(value as Record<string, JsonValue>);
    const bracketOpen = isArray ? "[" : "{";
    const bracketClose = isArray ? "]" : "}";
    const isEmpty = entries.length === 0;

    if (isEmpty) {
      return (
        <div className="flex items-center" style={{ paddingLeft: indent }}>
          {keyName !== undefined && (
            <span className="text-sky-400">
              {typeof keyName === "string" ? `"${keyName}"` : keyName}:{" "}
            </span>
          )}
          <span className="text-neutral-400">
            {bracketOpen}
            {bracketClose}
          </span>
        </div>
      );
    }

    return (
      <div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-neutral-800/50 rounded py-0.5"
          style={{ paddingLeft: indent }}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronIcon expanded={expanded} />
          {keyName !== undefined && (
            <span className="text-sky-400">
              {typeof keyName === "string" ? `"${keyName}"` : keyName}:{" "}
            </span>
          )}
          <span className="text-neutral-400">{bracketOpen}</span>
          {!expanded && (
            <>
              <span className="text-neutral-500 text-xs ml-1">
                {entries.length} {isArray ? "items" : "keys"}
              </span>
              <span className="text-neutral-400">{bracketClose}</span>
            </>
          )}
        </div>
        {expanded && (
          <>
            {entries.map(([key, val], index) => (
              <div key={String(key)}>
                <JsonNode
                  keyName={isArray ? undefined : (key as string)}
                  value={val}
                  depth={depth + 1}
                />
                {index < entries.length - 1 && (
                  <span
                    className="text-neutral-500"
                    style={{ paddingLeft: (depth + 1) * 16 }}
                  >
                    ,
                  </span>
                )}
              </div>
            ))}
            <div className="text-neutral-400" style={{ paddingLeft: indent }}>
              {bracketClose}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center py-0.5" style={{ paddingLeft: indent }}>
      {keyName !== undefined && (
        <span className="text-sky-400">"{keyName}": </span>
      )}
      <span className={getValueColor(value)}>{renderValue(value)}</span>
    </div>
  );
}

export default function JsonViewer({ data, title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide hover:text-neutral-300 transition-colors"
        >
          <ChevronIcon expanded={!collapsed} />
          {title}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-4">
          <code className="text-xs font-mono">
            <JsonNode value={data as JsonValue} />
          </code>
        </div>
      )}
    </div>
  );
}
