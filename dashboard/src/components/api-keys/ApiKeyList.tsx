import ApiKeyCard from "./ApiKeyCard";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used_at?: string;
  status: "active" | "never_used";
}

interface ApiKeyListProps {
  keys: ApiKey[];
  loading: boolean;
  onCreateClick: () => void;
  onCopyKey: (keyValue: string) => void;
  onRevokeKey: (keyId: string) => void;
  onNameChange?: (keyId: string, newName: string) => void;
}

export default function ApiKeyList({
  keys,
  loading,
  onCreateClick,
  onCopyKey,
  onRevokeKey,
  onNameChange,
}: ApiKeyListProps) {
  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded">
        <div className="px-4 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium">Active Keys</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-neutral-500">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading keys...</span>
          </div>
        </div>
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded">
        <div className="px-4 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium">Active Keys</h2>
        </div>
        <div className="py-12 text-center">
          <p className="text-sm text-neutral-500">No API keys</p>
          <button
            onClick={onCreateClick}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Create your first key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-medium">Active Keys</h2>
      </div>
      <div>
        {keys.map((key, index) => (
          <div
            key={key.id}
            className={
              index < keys.length - 1 ? "border-b border-neutral-800" : ""
            }
          >
            <ApiKeyCard
              id={key.id}
              name={key.name}
              keyValue={key.key}
              createdAt={key.created_at}
              lastUsedAt={key.last_used_at}
              status={key.status}
              onCopy={onCopyKey}
              onRevoke={onRevokeKey}
              onNameChange={onNameChange}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { ApiKey };
