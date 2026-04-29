import { useState } from "react";
import type { ProjectInfo } from "../../pages/Settings";

interface ProjectSettingsProps {
  project: ProjectInfo;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave: (name: string) => void;
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
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

export default function ProjectSettings({
  project,
  saveStatus,
  onSave,
}: ProjectSettingsProps) {
  const [name, setName] = useState(project.name);
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(project.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name);
  };

  const formattedDate = new Date(project.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium mb-1">General</h2>
      <p className="text-sm text-neutral-500 mb-6">
        Manage your project settings
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Name */}
        <div>
          <label
            htmlFor="projectName"
            className="block text-sm font-medium mb-2"
          >
            Project Name
          </label>
          <input
            id="projectName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-accent"
          />
          <p className="text-sm text-neutral-500 mt-1">
            This is used to identify your project in the dashboard.
          </p>
        </div>

        {/* Project ID */}
        <div>
          <label className="block text-sm font-medium mb-2">Project ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={project.id}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm font-mono text-neutral-500"
            />
            <button
              type="button"
              onClick={handleCopyId}
              className="px-3 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckIcon />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Created Date */}
        <div>
          <label className="block text-sm font-medium mb-2">Created</label>
          <p className="text-sm text-neutral-400">{formattedDate}</p>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved!"
                : "Save Changes"}
          </button>
          {saveStatus === "error" && (
            <span className="ml-3 text-sm text-error">
              Failed to save changes
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
