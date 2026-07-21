'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { db, User, PermissionMatrix, AccessLevel, DEFAULT_PERMISSION_MATRIX } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<User['role'], string> = {
  Admin: '#6366f1',
  Purchase: '#f59e0b',
  Site: '#10b981',
};

const ROLE_LABELS: Record<User['role'], string> = {
  Admin: '🛡️ Admin',
  Purchase: '🛒 Purchase',
  Site: '🏗️ Site',
};

// Display label → module key mapping (order matters for rendering)
const MODULE_ROWS: { label: string; key: string; locked?: User['role'][] }[] = [
  { label: 'Dashboard',       key: 'dashboard' },
  { label: 'Projects',        key: 'projects' },
  { label: 'BOQ Module',      key: 'boq' },
  { label: 'Purchase Module', key: 'procurement' },
  { label: 'Suppliers',       key: 'suppliers' },
  { label: 'Site Module',     key: 'inventory' },
  { label: 'Task Module',     key: 'tasks' },
  { label: 'Reports',         key: 'reports' },
  { label: 'User Management', key: 'users', locked: ['Purchase', 'Site'] }, // Admin always Full
];

const ROLES: User['role'][] = ['Admin', 'Purchase', 'Site'];

const ACCESS_CYCLE: AccessLevel[] = ['Full', 'View', 'None'];

const ACCESS_STYLE: Record<AccessLevel, { bg: string; color: string; label: string }> = {
  Full: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: '✔ Full' },
  View: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: '👁 View' },
  None: { bg: 'rgba(239,68,68,0.10)', color: '#f87171', label: '✕ None' },
};

// ─── User Form ────────────────────────────────────────────────────────────────

type FormState = {
  id?: string;
  username: string;
  role: User['role'];
  password_hash: string;
};

const emptyForm = (): FormState => ({ username: '', role: 'Purchase', password_hash: '' });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { isAdmin, currentUser, permissions, reloadPermissions } = useAuth();
  const router = useRouter();

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Permission matrix state
  const [matrix, setMatrix] = useState<PermissionMatrix>(permissions);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  // Keep local matrix in sync when context permissions change
  useEffect(() => {
    setMatrix(permissions);
    setMatrixDirty(false);
  }, [permissions]);

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return; }
    loadUsers();
    return db.subscribe(() => {
      loadUsers();
    });
  }, [isAdmin]);

  const loadUsers = () => setUsers(db.getUsers());

  // ── User CRUD ─────────────────────────────────────────────────────────────

  const openCreate = () => { setForm(emptyForm()); setEditing(false); setFormError(''); setShowModal(true); };
  const openEdit = (u: User) => {
    setForm({ id: u.id, username: u.username, role: u.role, password_hash: u.password_hash });
    setEditing(true); setFormError(''); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.username.trim()) { setFormError('Username is required.'); return; }
    if (!editing && !form.password_hash.trim()) { setFormError('Password is required.'); return; }
    const existing = db.getUserByUsername(form.username.trim());
    if (existing && existing.id !== form.id) { setFormError('Username already exists.'); return; }
    db.saveUser({ ...form, username: form.username.trim() });
    setShowModal(false);
    loadUsers();
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) { alert('You cannot delete your own account.'); return; }
    db.deleteUser(id);
    setConfirmDelete(null);
    loadUsers();
  };

  // ── Permission Matrix ─────────────────────────────────────────────────────

  const cycleAccess = useCallback((moduleKey: string, role: User['role']) => {
    // Admin always locked to Full for all modules
    if (role === 'Admin') return;
    // Some modules may be locked for certain roles
    const row = MODULE_ROWS.find(r => r.key === moduleKey);
    if (row?.locked?.includes(role)) return;

    setMatrix(prev => {
      const current = (prev[moduleKey]?.[role] as AccessLevel) ?? 'None';
      const nextIdx = (ACCESS_CYCLE.indexOf(current) + 1) % ACCESS_CYCLE.length;
      const next = ACCESS_CYCLE[nextIdx];
      return {
        ...prev,
        [moduleKey]: {
          ...prev[moduleKey],
          [role]: next,
        }
      };
    });
    setMatrixDirty(true);
  }, []);

  const saveMatrix = () => {
    db.savePermissions(matrix);
    reloadPermissions();
    setMatrixDirty(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const resetMatrix = () => {
    const fresh = db.resetPermissions();
    setMatrix(fresh);
    reloadPermissions();
    setMatrixDirty(false);
  };

  if (!isAdmin) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-content" style={{ padding: '1.5rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>👥 User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Admin-only — manage users and configure role access permissions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create User</button>
      </div>

      {/* ── Editable Role Access Matrix ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>
              🔐 Role Access Matrix
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
              Click any cell to cycle through access levels: <strong style={{ color: '#34d399' }}>Full</strong> → <strong style={{ color: '#fbbf24' }}>View</strong> → <strong style={{ color: '#f87171' }}>None</strong>.
              {' '}Admin column is always Full.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {saveFlash && (
              <span style={{ color: '#34d399', fontSize: '0.82rem', fontWeight: '600', animation: 'fadeIn 0.3s ease' }}>
                ✓ Saved!
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={resetMatrix}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              ↺ Reset Defaults
            </button>
            <button
              className="btn btn-primary"
              onClick={saveMatrix}
              disabled={!matrixDirty}
              style={{
                fontSize: '0.8rem', padding: '0.35rem 0.75rem',
                opacity: matrixDirty ? 1 : 0.5,
                cursor: matrixDirty ? 'pointer' : 'not-allowed'
              }}
            >
              💾 Save Changes
            </button>
          </div>
        </div>

        {matrixDirty && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            color: '#fbbf24', padding: '0.5rem 0.85rem', borderRadius: '8px',
            fontSize: '0.8rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            ⚠️ You have unsaved changes. Click <strong>Save Changes</strong> to apply them.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', width: '35%' }}>
                  Module
                </th>
                {ROLES.map(role => (
                  <th key={role} style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: ROLE_COLORS[role], fontWeight: '700', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }}>
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_ROWS.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: '500', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {row.label}
                  </td>
                  {ROLES.map(role => {
                    const level = (matrix[row.key]?.[role] ?? 'None') as AccessLevel;
                    const style = ACCESS_STYLE[level];
                    const isLocked = role === 'Admin' || row.locked?.includes(role);
                    return (
                      <td key={role} style={{ textAlign: 'center', padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <button
                          onClick={() => cycleAccess(row.key, role)}
                          title={isLocked ? (role === 'Admin' ? 'Admin always has Full access' : 'This access level is fixed') : 'Click to change access level'}
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.color}33`,
                            cursor: isLocked ? 'default' : 'pointer',
                            opacity: isLocked ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                            minWidth: '72px',
                            letterSpacing: '0.2px',
                          }}
                          onMouseOver={e => { if (!isLocked) e.currentTarget.style.transform = 'scale(1.06)'; }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {style.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: '700', margin: 0, fontSize: '0.95rem' }}>
            All Users ({users.length})
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {u.username}
                    {u.id === currentUser?.id && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>You</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700',
                      background: `${ROLE_COLORS[u.role]}22`, color: ROLE_COLORS[u.role]
                    }}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} onClick={() => openEdit(u)}>
                        ✏️ Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => setConfirmDelete(u.id)}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit User Modal ── */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit User' : 'Create New User'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ⚠️ {formError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. john.doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as User['role'] }))}>
                  <option value="Admin">🛡️ Admin — Full access</option>
                  <option value="Purchase">🛒 Purchase — PO & Suppliers</option>
                  <option value="Site">🏗️ Site — Inventory & Issues</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{editing ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                <input className="form-input" type="password" value={form.password_hash} onChange={e => setForm(f => ({ ...f, password_hash: e.target.value }))} placeholder={editing ? 'Leave blank to keep unchanged' : 'Set a strong password'} />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 Update User' : '✅ Create User'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h2>⚠️ Confirm Delete</h2>
              <button className="close-btn" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Are you sure you want to delete this user? This action cannot be undone.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
