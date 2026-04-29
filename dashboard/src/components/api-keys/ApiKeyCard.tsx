import { useState } from "react";

interface ApiKeyCardProps {
  id: string;
  name: string;
  keyValue: string;
  createdAt: string;
  lastUsedAt?: string;
  status: "active" | "never_used";
  onCopy: (keyValue: string) => void;
  onRevoke: (id: string) => void;
  onNameChange?: (id: string, newName: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLastUsed(dateString?: string): string {
  if (!dateString) return "Never used";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Icons
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
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const EyeIcon = () => (
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
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
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
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

export default function ApiKeyCard({
  id,
  name,
  keyValue,
  createdAt,
  lastUsedAt,
  status,
  onCopy,
  onRevoke,
  onNameChange,
}: ApiKeyCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const handleCopy = async () => {
    onCopy(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== name && onNameChange) {
      onNameChange(id, editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSave();
    } else if (e.key === "Escape") {
      setEditedName(name);
      setIsEditingName(false);
    }
  };

  // Mask the key, showing only first 7 chars and last 4
  const maskedKey = isRevealed
    ? keyValue
    : `${keyValue.substring(0, 7)}${"*".repeat(Math.max(0, keyValue.length - 11))}${keyValue.slice(-4)}`;

  return (
    <div className="flex items-center justify-between px-4 py-4 hover:bg-neutral-850 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              autoFocus
              className="text-sm font-medium bg-neutral-950 border border-neutral-700 rounded px-2 py-0.5 focus:border-accent focus:outline-none"
            />
          ) : (
            <span
              className={`text-sm font-medium ${onNameChange ? "cursor-pointer hover:text-accent" : ""}`}
              onClick={() => onNameChange && setIsEditingName(true)}
              title={onNameChange ? "Click to edit" : undefined}
            >
              {name}
            </span>
          )}
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              status === "active"
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            {status === "active" ? "Active" : "Never Used"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className="font-mono truncate max-w-[280px]">
              {maskedKey}
            </span>
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className="p-0.5 hover:text-neutral-300 transition-colors"
              title={isRevealed ? "Hide key" : "Reveal key"}
            >
              {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <span>Created {formatDate(createdAt)}</span>
          <span className={!lastUsedAt ? "text-neutral-600" : ""}>
            {lastUsedAt
              ? `Last used ${formatLastUsed(lastUsedAt)}`
              : "Never used"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 rounded transition-colors flex items-center gap-1.5"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={() => onRevoke(id)}
          className="px-3 py-1.5 text-xs text-error border border-error/30 hover:bg-error/10 hover:border-error/50 rounded transition-colors"
        >
          Revoke
        </button>
      </div>
    </div>
  );
}
