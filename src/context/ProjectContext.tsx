'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Project, db } from '@/lib/db';

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string;
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => void;
  isSyncing: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncData: () => Promise<void>;
  lastUpdated: number;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string>('');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  // Use refs to track current values without causing re-renders
  const activeProjectIdRef = useRef<string>('');
  const syncDoneRef = useRef(false);

  const refreshProjects = useCallback(() => {
    const list = db.getProjects();

    // Use JSON.stringify for deep comparison to correctly detect any changes (client, consultant, budget, name, etc.)
    setProjects(prev => {
      if (JSON.stringify(prev) === JSON.stringify(list)) {
        return prev; // Return same reference → no re-render
      }
      return list;
    });

    if (list.length > 0) {
      const savedId = localStorage.getItem('active_project_id');
      const exists = list.some(p => p.id === savedId);
      const targetId = (savedId && exists) ? savedId : list[0].id;

      if (targetId !== activeProjectIdRef.current) {
        // Active project changed — update both state and ref
        activeProjectIdRef.current = targetId;
        setActiveProjectIdState(targetId);
        setActiveProject(list.find(p => p.id === targetId) || list[0]);
        if (!exists || !savedId) {
          localStorage.setItem('active_project_id', targetId);
        }
      } else {
        // If ID didn't change, activeProject data might have changed (e.g. edited details)
        const updatedActive = list.find(p => p.id === targetId) || null;
        setActiveProject(prevActive => {
          if (JSON.stringify(prevActive) === JSON.stringify(updatedActive)) {
            return prevActive;
          }
          return updatedActive;
        });
      }
    } else {
      if (activeProjectIdRef.current !== '') {
        activeProjectIdRef.current = '';
        setActiveProjectIdState('');
        setActiveProject(null);
      }
    }
    setLastUpdated(Date.now());
  }, []); // Empty deps — this function never needs to change

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    try {
      await db.syncFromSupabase();
      setSyncStatus('success');
      refreshProjects();
      // Keep success state visible for 4 seconds
      setTimeout(() => {
        setSyncStatus('idle');
      }, 4000);
    } catch (error) {
      console.error('Data sync failed:', error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshProjects]);

  useEffect(() => {
    if (syncDoneRef.current) return; // Prevent double-run in React Strict Mode
    syncDoneRef.current = true;

    syncData();
  }, [syncData]);

  // Subscribe to db updates to refresh context projects reactively
  useEffect(() => {
    refreshProjects();
    return db.subscribe(() => {
      refreshProjects();
    });
  }, [refreshProjects]);

  const setActiveProjectId = useCallback((id: string) => {
    activeProjectIdRef.current = id;
    setActiveProjectIdState(id);
    const proj = projects.find(p => p.id === id) || null;
    setActiveProject(proj);
    localStorage.setItem('active_project_id', id);
  }, [projects]);

  // Memoize context value so consumers only re-render when values actually change
  const contextValue = useMemo(() => ({
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    refreshProjects,
    isSyncing,
    syncStatus,
    syncData,
    lastUpdated,
  }), [projects, activeProjectId, activeProject, setActiveProjectId, refreshProjects, isSyncing, syncStatus, syncData, lastUpdated]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
