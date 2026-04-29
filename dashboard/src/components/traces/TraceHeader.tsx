import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface TraceHeaderProps {
  traceId: string;
  status: "success" | "error";
  timestamp: string;
  provider: string;
  model: string;
}

const ArrowLeftIcon = () => (
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
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusBadge({ status }: { status: "success" | "error" }) {
  const isSuccess = status === "success";
  return (
    <span
      className={`text-sm px-2.5 py-1 rounded font-medium ${
        isSuccess ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {isSuccess ? "Success" : "Error"}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="text-xs px-2 py-1 bg-neutral-800 text-neutral-300 rounded capitalize">
      {provider}
    </span>
  );
}

function ModelBadge({ model }: { model: string }) {
  return (
    <span className="text-xs px-2 py-1 bg-neutral-850 text-neutral-400 rounded font-mono">
      {model}
    </span>
  );
}

export default function TraceHeader({
  traceId,
  status,
  timestamp,
  provider,
  model,
}: TraceHeaderProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-neutral-800 bg-neutral-950 flex-shrink-0">
      {/* Top row: Back button, trace ID, status */}
      <div className="h-14 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard/traces")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-850 rounded transition-colors"
          >
            <ArrowLeftIcon />
            <span>Traces</span>
          </button>
          <div className="w-px h-5 bg-neutral-800" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-accent">{traceId}</span>
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
              title="Copy trace ID"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Bottom row: Timestamp, provider, model */}
      <div className="px-6 pb-4 flex items-center gap-4">
        <span className="text-sm text-neutral-500">
          {formatTimestamp(timestamp)}
        </span>
        <div className="flex items-center gap-2">
          <ProviderBadge provider={provider} />
          <ModelBadge model={model} />
        </div>
      </div>
    </header>
  );
}
