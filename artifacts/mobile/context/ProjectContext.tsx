import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Project, PageSummary } from "@/types";
import { API } from "@/services/api";

interface ProjectContextValue {
  projects: Project[];
  loaded: boolean;
  createProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  addPage: (projectId: string, imageBase64: string) => Promise<void>;
  clearFailedPages: (projectId: string) => void;
  generateDocument: (projectId: string) => Promise<string>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_KEY = "docscan_projects_v1";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureCounterRef = useRef<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Project[];
            setProjects(parsed);
            for (const p of parsed) {
              captureCounterRef.current[p.id] = p.pages.length;
            }
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
    captureCounterRef.current[project.id] = 0;
    setAndPersist((prev) => [project, ...prev]);
    return project;
  };

  const deleteProject = (id: string) => {
    delete captureCounterRef.current[id];
    setAndPersist((prev) => prev.filter((p) => p.id !== id));
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const addPage = async (projectId: string, imageBase64: string): Promise<void> => {
    const counter = captureCounterRef.current[projectId] ?? 0;
    const captureOrder = counter;
    captureCounterRef.current[projectId] = counter + 1;

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
      const result = await API.processPage(imageBase64, projectId, captureOrder);
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

  const clearFailedPages = (projectId: string) => {
    setAndPersist((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          pages: p.pages.filter((pg) => !pg.error),
        };
      }),
    );
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
        clearFailedPages,
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
