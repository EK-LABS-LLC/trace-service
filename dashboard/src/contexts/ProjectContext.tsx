import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { ProjectContext, type Project } from "./project-context";

const SELECTED_PROJECT_KEY = "pulse_selected_project";

interface ProjectsResponse {
  projects: Project[];
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(
    null,
  );
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsProjectLoading(true);
    try {
      const res = await fetch("/dashboard/api/projects", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ProjectsResponse;
      setProjects(data.projects);

      const savedId = localStorage.getItem(SELECTED_PROJECT_KEY);
      const saved = data.projects.find((p) => p.id === savedId);
      if (saved) {
        setSelectedProjectState(saved);
      } else if (data.projects.length > 0) {
        const firstProject = data.projects[0] ?? null;
        setSelectedProjectState(firstProject);
        if (firstProject) {
          localStorage.setItem(SELECTED_PROJECT_KEY, firstProject.id);
        }
      } else {
        setSelectedProjectState(null);
      }
    } catch {
      // ignore fetch errors
    } finally {
      setIsProjectLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshProjects();
      return;
    }

    localStorage.removeItem(SELECTED_PROJECT_KEY);
    setProjects([]);
    setSelectedProjectState(null);
    setIsProjectLoading(false);
  }, [isAuthenticated, refreshProjects]);

  const setSelectedProject = (project: Project) => {
    setSelectedProjectState(project);
    localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        isProjectLoading,
        setSelectedProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
