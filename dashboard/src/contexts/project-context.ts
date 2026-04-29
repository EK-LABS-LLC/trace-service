import { createContext } from "react";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  role: string;
}

export interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  isProjectLoading: boolean;
  setSelectedProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextType | null>(null);
