import { useState } from "react";
import { createApiKey } from "../../lib/apiClient";

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: (fullKey: string) => void;
}

const CloseIcon = () => (
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
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const SuccessIcon = () => (
  <svg
    className="w-5 h-5 text-success"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const WarningIcon = () => (
  <svg
    className="w-4 h-4 text-warning flex-shrink-0 mt-0.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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

type ModalStep = "confirm" | "success";

export default function CreateApiKeyModal({
  isOpen,
  onClose,
  onKeyCreated,
}: CreateApiKeyModalProps) {
  const [step, setStep] = useState<ModalStep>("confirm");
  const [createdKey, setCreatedKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setStep("confirm");
    setCreatedKey("");
    setCopied(false);
    setError("");
    onClose();
  };

  const handleCreate = async () => {
    if (isCreating) return;

    setIsCreating(true);
    setError("");
    try {
      const result = await createApiKey();
      setCreatedKey(result.apiKey);
      setStep("success");
      onKeyCreated(result.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      onKeyDown={handleKeyDown}
    >
      {step === "confirm" ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md mx-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <h3 className="text-sm font-medium">Create API Key</h3>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-neutral-800 rounded"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-neutral-400 mb-4">
              Generate a new API key for the currently selected project. The key
              will be shown only once.
            </p>
            {error && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isCreating ? "Creating..." : "Create Key"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-lg mx-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <SuccessIcon />
              <h3 className="text-sm font-medium">API Key Created</h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-neutral-800 rounded"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="p-4">
            <div className="bg-warning/5 border border-warning/20 rounded p-3 mb-4">
              <div className="flex gap-2">
                <WarningIcon />
                <p className="text-xs text-warning">
                  Copy this key now. You won't be able to see it again.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-2">
                Your API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdKey}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono text-neutral-300"
                />
                <button
                  onClick={handleCopyKey}
                  className="px-3 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded flex items-center gap-2 transition-colors"
                >
                  {copied ? (
                    "Copied!"
                  ) : (
                    <>
                      <CopyIcon />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end px-4 py-3 border-t border-neutral-800">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
