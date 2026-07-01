'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProjectProvider, useProject } from '@/context/ProjectContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/LoginPage';
import { db } from '@/lib/db';

function Header() {
  const pathname = usePathname();
  const { projects, activeProjectId, setActiveProjectId, isSyncing, syncStatus, syncData } = useProject();
  const { currentUser, logout, canAccess } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const roleColors: Record<string, string> = {
    Admin: '#6366f1',
    Purchase: '#f59e0b',
    Site: '#10b981',
  };
  const roleColor = currentUser ? roleColors[currentUser.role] || '#6366f1' : '#6366f1';

  const company = db.getCompanyDetails();

  return (
    <header className="navbar" style={{ position: 'relative', zIndex: 200 }}>
      <Link href="/" className="brand">
        {company.logo ? (
          <img 
            src={company.logo} 
            alt="Logo" 
            style={{ maxHeight: '38px', maxWidth: '120px', borderRadius: '4px', objectFit: 'contain' }} 
          />
        ) : (
          <div className="brand-logo">{company.name.charAt(0)}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
          <span className="brand-text" style={{ fontSize: '0.95rem', fontWeight: '700' }}>{company.name}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', marginTop: '1px' }}>PMS</span>
        </div>
      </Link>

      <nav className="nav-links">
        {canAccess('dashboard') && (
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Dashboard</Link>
        )}
        {canAccess('projects') && (
          <Link href="/projects" className={`nav-link ${pathname === '/projects' ? 'active' : ''}`}>Projects</Link>
        )}
        {canAccess('boq') && (
          <Link href="/boq" className={`nav-link ${pathname === '/boq' ? 'active' : ''}`}>BOQ Module</Link>
        )}
        {canAccess('procurement') && (
          <Link href="/procurement" className={`nav-link ${pathname === '/procurement' ? 'active' : ''}`}>Purchase Module</Link>
        )}
        {canAccess('suppliers') && (
          <Link href="/suppliers" className={`nav-link ${pathname === '/suppliers' ? 'active' : ''}`}>Suppliers</Link>
        )}
        {canAccess('inventory') && (
          <Link href="/inventory" className={`nav-link ${pathname === '/inventory' ? 'active' : ''}`}>Site Module</Link>
        )}
        {canAccess('reports') && (
          <Link href="/reports" className={`nav-link ${pathname === '/reports' ? 'active' : ''}`}>Reporting Module</Link>
        )}
        {canAccess('users') && (
          <Link href="/users" className={`nav-link ${pathname === '/users' ? 'active' : ''}`}>
            👥 Users
          </Link>
        )}
        {canAccess('users') && (
          <Link href="/settings" className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}>
            ⚙️ Settings
          </Link>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="project-selector-container">
          <span className="project-selector-label">Project:</span>
          <select
            className="project-select"
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
          >
            {projects.length === 0 ? (
              <option value="">No Active Projects</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>

        {/* Supabase Sync Button & Indicator */}
        <button
          onClick={() => syncData()}
          disabled={isSyncing}
          title="Force Sync with Supabase"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: isSyncing 
              ? 'rgba(56, 189, 248, 0.12)' 
              : syncStatus === 'success' 
                ? 'rgba(74, 222, 128, 0.12)' 
                : syncStatus === 'error' 
                  ? 'rgba(248, 113, 113, 0.12)' 
                  : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${
              isSyncing 
                ? '#38bdf8' 
                : syncStatus === 'success' 
                  ? '#4ade80' 
                  : syncStatus === 'error' 
                    ? '#f87171' 
                    : 'rgba(255, 255, 255, 0.12)'
            }`,
            borderRadius: '10px',
            padding: '0.45rem 0.8rem',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            color: isSyncing 
              ? '#38bdf8' 
              : syncStatus === 'success' 
                ? '#4ade80' 
                : syncStatus === 'error' 
                  ? '#f87171' 
                  : '#f8fafc',
            fontSize: '0.8rem',
            fontWeight: '600',
            transition: 'all 0.25s ease',
            outline: 'none',
            boxShadow: isSyncing ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none'
          }}
          onMouseOver={e => {
            if (!isSyncing && syncStatus === 'idle') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }
          }}
          onMouseOut={e => {
            if (!isSyncing && syncStatus === 'idle') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }
          }}
        >
          <span style={{
            display: 'inline-block',
            animation: isSyncing ? 'spin 1s linear infinite' : 'none',
            fontSize: '0.9rem',
            lineHeight: '1'
          }}>
            {isSyncing ? '🔄' : syncStatus === 'success' ? '✅' : syncStatus === 'error' ? '⚠️' : '🔄'}
          </span>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
            {isSyncing ? 'Syncing...' : syncStatus === 'success' ? 'Synced' : syncStatus === 'error' ? 'Sync Error' : 'Sync'}
          </span>
        </button>

        {/* User badge + logout */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px', padding: '0.35rem 0.75rem', cursor: 'pointer',
              color: '#f8fafc', fontSize: '0.82rem', fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <span style={{
              background: roleColor, borderRadius: '6px',
              padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: '700',
              color: '#fff', letterSpacing: '0.3px'
            }}>
              {currentUser?.role}
            </span>
            <span>{currentUser?.username}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>▾</span>
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '0.5rem', minWidth: '160px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 999
            }}>
              <div style={{ padding: '0.4rem 0.75rem', color: '#94a3b8', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.4rem' }}>
                Signed in as <strong style={{ color: '#f8fafc' }}>{currentUser?.username}</strong>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                style={{
                  width: '100%', textAlign: 'left', background: 'none',
                  border: 'none', color: '#f87171', padding: '0.5rem 0.75rem',
                  cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem',
                  fontWeight: '500', transition: 'background 0.15s'
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  // Always render ProjectProvider so it never unmounts/remounts when auth state changes.
  // Show LoginPage as an overlay when not authenticated.
  return (
    <ProjectProvider>
      {!currentUser ? (
        <LoginPage />
      ) : (
        <>
          <Header />
          <main className="app-container">{children}</main>
        </>
      )}
    </ProjectProvider>
  );
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
