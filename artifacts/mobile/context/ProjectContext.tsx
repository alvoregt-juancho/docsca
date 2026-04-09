import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Project, PageSummary } from "@/types";
import { API, type PageCorners } from "@/services/api";

interface ProjectContextValue {
  projects: Project[];
  loaded: boolean;
  createProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  addPage: (projectId: string, imageBase64: string, corners?: PageCorners) => Promise<void>;
  generateDocument: (projectId: string) => Promise<string>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = "docscan_projects_v1";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setProjects(JSON.parse(raw));
          } catch {}
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const persistProjects = (updated: Project[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    }, 300);
  };

  const setAndPersist = (updater: (prev: Project[]) => Project[]) => {
    setProjects((prev) => {
      const next = updater(prev);
      persistProjects(next);
      return next;
    });
  };

  const createProject = (name: string): Project => {
    const project: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: Date.now(),
      pages: [],
    };
    setAndPersist((prev) => [project, ...prev]);
    return project;
  };

  const deleteProject = (id: string) => {
    setAndPersist((prev) => prev.filter((p) => p.id !== id));
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const addPage = async (projectId: string, imageBase64: string, corners?: PageCorners): Promise<void> => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Proyecto no encontrado");

    const captureOrder = project.pages.length;
    const tempId = `${projectId}-${captureOrder}-tmp`;

    const tempPage: PageSummary = {
      id: tempId,
      captureOrder,
      detectedPageNumber: null,
      wordCount: 0,
      hasImages: false,
      hasTables: false,
      processedAt: Date.now(),
      isProcessing: true,
    };

    setAndPersist((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, pages: [...p.pages, tempPage] } : p,
      ),
    );

    try {
      const result = await API.processPage(imageBase64, projectId, captureOrder, corners);
      const finalPage: PageSummary = {
        id: result.pageId,
        captureOrder,
        detectedPageNumber: result.detectedPageNumber,
        wordCount: result.wordCount,
        hasImages: result.hasImages,
        hasTables: result.hasTables,
        processedAt: Date.now(),
        isProcessing: false,
      };
      setAndPersist((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            pages: p.pages.map((pg) => (pg.id === tempId ? finalPage : pg)),
          };
        }),
      );
    } catch (err) {
      setAndPersist((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            pages: p.pages.map((pg) =>
              pg.id === tempId
                ? { ...pg, isProcessing: false, error: (err as Error).message }
                : pg,
            ),
          };
        }),
      );
      throw err;
    }
  };

  const generateDocument = async (projectId: string): Promise<string> => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Proyecto no encontrado");
    if (project.pages.length === 0) throw new Error("No hay páginas");

    const result = await API.generateDocument(projectId, project.name);
    setAndPersist((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, documentId: result.documentId } : p,
      ),
    );
    return result.documentId;
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        loaded,
        createProject,
        deleteProject,
        getProject,
        addPage,
        generateDocument,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be inside ProjectProvider");
  return ctx;
}
