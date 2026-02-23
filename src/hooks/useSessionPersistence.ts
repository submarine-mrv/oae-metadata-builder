"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { AppFormState } from "@/types/forms";
import type { ExperimentData, DatasetData } from "@/contexts/AppStateContext";
import type { ProjectFormData } from "@/types/forms";

const STORAGE_KEY = "oae-metadata-builder-session";
const DEBOUNCE_MS = 2000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SavedSession {
  savedAt: number;
  hasProject: boolean;
  projectData: ProjectFormData;
  experiments: ExperimentData[];
  datasets: DatasetData[];
  nextExperimentId: number;
  nextDatasetId: number;
}

function sessionHasContent(state: AppFormState): boolean {
  return (
    state.hasProject ||
    state.experiments.length > 0 ||
    state.datasets.length > 0
  );
}

function isValidSavedSession(data: unknown): data is SavedSession {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.savedAt === "number" &&
    typeof obj.hasProject === "boolean" &&
    typeof obj.projectData === "object" &&
    obj.projectData !== null &&
    Array.isArray(obj.experiments) &&
    Array.isArray(obj.datasets) &&
    typeof obj.nextExperimentId === "number" &&
    typeof obj.nextDatasetId === "number"
  );
}

function loadSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSavedSession(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Expire sessions older than 30 days
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useSessionPersistence(
  state: AppFormState,
  restoreFullState: (saved: {
    hasProject: boolean;
    projectData: ProjectFormData;
    experiments: ExperimentData[];
    datasets: DatasetData[];
    nextExperimentId: number;
    nextDatasetId: number;
  }) => void
) {
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const initialLoadDone = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Track whether user has made a restore/discard decision
  const userDecided = useRef(false);

  // Load saved session once on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const saved = loadSavedSession();
    if (saved) {
      setSavedSession(saved);
      setIsRestoreModalOpen(true);
    } else {
      // No saved session — enable autosave immediately
      userDecided.current = true;
    }
  }, []);

  // Autosave with debounce — skip when user hasn't decided yet (to avoid
  // overwriting a valid save with the empty initial state)
  useEffect(() => {
    if (!userDecided.current) return;
    if (!sessionHasContent(state)) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const toSave: SavedSession = {
        savedAt: Date.now(),
        hasProject: state.hasProject,
        projectData: state.projectData,
        experiments: state.experiments,
        datasets: state.datasets,
        nextExperimentId: state.nextExperimentId,
        nextDatasetId: state.nextDatasetId
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state]);

  const restoreSession = useCallback(() => {
    if (!savedSession) return;
    restoreFullState({
      hasProject: savedSession.hasProject,
      projectData: savedSession.projectData,
      experiments: savedSession.experiments,
      datasets: savedSession.datasets,
      nextExperimentId: savedSession.nextExperimentId,
      nextDatasetId: savedSession.nextDatasetId
    });
    setSavedSession(null);
    setIsRestoreModalOpen(false);
    userDecided.current = true;
  }, [savedSession, restoreFullState]);

  const discardSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSavedSession(null);
    setIsRestoreModalOpen(false);
    userDecided.current = true;
  }, []);

  return {
    savedSession,
    isRestoreModalOpen,
    restoreSession,
    discardSession
  };
}
