import { useState } from "react";
import ProjectSettings from "../components/settings/ProjectSettings";
import DangerZone from "../components/settings/DangerZone";
import { useProject } from "../hooks/useProject";

export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: string;
}

export default function Settings() {
  const { selectedProject } = useProject();
  const [projectNameOverrides, setProjectNameOverrides] = useState<
    Record<string, string>
  >({});

  const project = selectedProject
    ? {
        id: selectedProject.id,
        name: projectNameOverrides[selectedProject.id] ?? selectedProject.name,
        createdAt: selectedProject.createdAt,
      }
    : null;

  const [error] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const handleSaveProject = async (name: string) => {
    setSaveStatus("saving");
    try {
      // TODO: Replace with actual API call when endpoint is available
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (selectedProject) {
        setProjectNameOverrides((prev) => ({
          ...prev,
          [selectedProject.id]: name,
        }));
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      console.error("Failed to save project:", err);
    }
  };

  const handleDeleteProject = async () => {
    // TODO: Implement project deletion API
    window.location.href = "/login";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <h1 className="text-sm font-medium">Settings</h1>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Error Banner */}
          {error && (
            <div className="bg-error/5 border border-error/20 rounded p-4 mb-6">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-error flex-shrink-0 mt-0.5"
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
                <div>
                  <p className="text-sm text-error">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-sm text-accent hover:underline mt-1 inline-block"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project Settings Section */}
          {project && (
            <ProjectSettings
              project={project}
              saveStatus={saveStatus}
              onSave={handleSaveProject}
            />
          )}

          {/* Danger Zone Section */}
          {project && (
            <DangerZone
              projectName={project.name}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </div>
      </div>
    </div>
  );
}
