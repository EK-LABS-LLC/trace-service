import { useState } from "react";

interface DangerZoneProps {
  projectName: string;
  onDeleteProject: () => void;
}

const WarningIcon = () => (
  <svg
    className="w-5 h-5 text-error flex-shrink-0"
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

export default function DangerZone({
  projectName,
  onDeleteProject,
}: DangerZoneProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== projectName) return;

    setIsDeleting(true);
    try {
      await onDeleteProject();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setIsDeleting(false);
    }
  };

  const canDelete = confirmText === projectName;

  return (
    <>
      <section className="pt-6 border-t border-neutral-800">
        <h2 className="text-lg font-medium text-error mb-1">Danger Zone</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Irreversible actions that affect your entire project
        </p>

        <div className="bg-error/5 border border-error/20 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Delete Project</div>
              <p className="text-sm text-neutral-500 mt-0.5">
                Permanently delete this project and all associated data
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-sm text-error border border-error/30 hover:bg-error/10 hover:border-error/50 rounded transition-colors"
            >
              Delete Project
            </button>
          </div>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-medium">Delete Project</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                }}
                className="p-1 hover:bg-neutral-800 rounded"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="p-4">
              <div className="bg-error/5 border border-error/20 rounded p-3 mb-4">
                <div className="flex gap-2">
                  <WarningIcon />
                  <div>
                    <p className="text-sm text-error font-medium">
                      This action cannot be undone
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      All traces, sessions, API keys, and analytics data will be
                      permanently deleted.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-neutral-400 mb-4">
                To confirm, type{" "}
                <span className="text-white font-mono bg-neutral-800 px-1.5 py-0.5 rounded">
                  {projectName}
                </span>{" "}
                below:
              </p>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={projectName}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-error"
              />
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                }}
                className="px-4 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canDelete || isDeleting}
                className="px-4 py-2 text-sm text-white bg-error hover:bg-error/80 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
