'use client';

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef, ReactNode
} from 'react';
import { db, User, PermissionMatrix, DEFAULT_PERMISSION_MATRIX } from '@/lib/db';

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
  isPurchase: boolean;
  isSite: boolean;
  permissions: PermissionMatrix;
  reloadPermissions: () => void;
  canAccess: (module: string) => boolean;
  canWrite: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [permissions, setPermissions] = useState<PermissionMatrix>(DEFAULT_PERMISSION_MATRIX);

  // Use a ref so login/logout can always access latest currentUser without being recreated
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  const reloadPermissions = useCallback(() => {
    const perms = db.getPermissions();
    // Only update state if permissions actually changed (avoids unnecessary re-renders)
    setPermissions(prev => {
      if (JSON.stringify(prev) === JSON.stringify(perms)) return prev;
      return perms;
    });
  }, []);

  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current) return; // Guard against React Strict Mode double-run
    initDoneRef.current = true;

    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('pms_current_user');
      if (stored) {
        try {
          const user = JSON.parse(stored) as User;
          setCurrentUser(user);
          currentUserRef.current = user;
        } catch {
          sessionStorage.removeItem('pms_current_user');
        }
      }
      reloadPermissions();
      setLoaded(true);
    }
  }, [reloadPermissions]);

  // Stable function references — never recreated
  const login = useCallback((username: string, password: string): boolean => {
    const user = db.authenticate(username, password);
    if (user) {
      setCurrentUser(user);
      currentUserRef.current = user;
      sessionStorage.setItem('pms_current_user', JSON.stringify(user));
      reloadPermissions();
      return true;
    }
    return false;
  }, [reloadPermissions]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    currentUserRef.current = null;
    sessionStorage.removeItem('pms_current_user');
  }, []);

  const canAccess = useCallback((module: string): boolean => {
    if (!currentUser) return false;
    const row = permissions[module];
    if (!row) return false;
    const level = row[currentUser.role as keyof typeof row];
    return level === 'Full' || level === 'View';
  }, [currentUser, permissions]);

  const canWrite = useCallback((module: string): boolean => {
    if (!currentUser) return false;
    const row = permissions[module];
    if (!row) return false;
    const level = row[currentUser.role as keyof typeof row];
    return level === 'Full';
  }, [currentUser, permissions]);

  // Memoize the context value — only changes when actual data changes
  const contextValue = useMemo<AuthContextType>(() => ({
    currentUser,
    login,
    logout,
    isAdmin: currentUser?.role === 'Admin',
    isPurchase: currentUser?.role === 'Purchase',
    isSite: currentUser?.role === 'Site',
    permissions,
    reloadPermissions,
    canAccess,
    canWrite,
  }), [currentUser, login, logout, permissions, reloadPermissions, canAccess, canWrite]);

  // Don't block render with null — render a stable empty shell instead
  if (!loaded) {
    return (
      <AuthContext.Provider value={contextValue}>
        {null}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
