'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { activeProject, activeProjectId } = useProject();
  const { canAccess } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any[]>([]);

  useEffect(() => {
    if (!canAccess('dashboard')) {
      router.push('/projects');
    }
  }, [canAccess, router]);

  useEffect(() => {
    if (activeProjectId) {
      const summary = db.getFinancialCostSummary(activeProjectId);
      const boqFlow = db.getBOQWorkflowSummary(activeProjectId);
      setStats(summary);
      setWorkflow(boqFlow);
    } else {
      setStats(null);
      setWorkflow([]);
    }
  }, [activeProjectId]);

  if (!canAccess('dashboard')) {
    return null;
  }

  if (!activeProject) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2>Welcome to DIMAH AL RAEDAH SPC PMS</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem 0' }}>
          Get started by creating a project or selecting one from the top bar.
        </p>
        <Link href="/projects" className="btn btn-primary">
          Create First Project
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Project Dashboard</h1>
          <p>Real-time oversight for {activeProject.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/procurement" className="btn btn-primary">
            + New PO
          </Link>
          <Link href="/inventory" className="btn btn-secondary">
            Material Issue Note
          </Link>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-title">Approved BOQ Budget</span>
          <span className="stat-value">OMR {stats?.boq_total?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
          <span className="stat-sub">VAT: OMR {stats?.boq_total?.vat.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
        </div>
        <div className="card stat-card secondary">
          <span className="stat-title">PO Issued Value</span>
          <span className="stat-value">OMR {stats?.po_issued?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
          <span className="stat-sub">VAT: OMR {stats?.po_issued?.vat.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
        </div>
        <div className="card stat-card success">
          <span className="stat-title">Received (GRN) Value</span>
          <span className="stat-value">OMR {stats?.received?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
          <span className="stat-sub">VAT: OMR {stats?.received?.vat.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
        </div>
        <div className="card stat-card accent">
          <span className="stat-title">Site Material Issued</span>
          <span className="stat-value">OMR {stats?.used?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
          <span className="stat-sub">VAT: OMR {stats?.used?.vat.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}</span>
        </div>
      </div>

      {/* Project details card */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>BOQ Items Progress Tracking</h2>
          {workflow.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No BOQ items configured. Visit the BOQ page to add items.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Approved Qty</th>
                    <th style={{ textAlign: 'right' }}>Ordered</th>
                    <th style={{ textAlign: 'right' }}>Received</th>
                    <th style={{ textAlign: 'right' }}>Consumed</th>
                    <th style={{ textAlign: 'right' }}>Site Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {workflow.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: 'right' }}>{item.approved_qty} {item.unit}</td>
                      <td style={{ textAlign: 'right', color: item.ordered_qty > 0 ? 'var(--primary)' : 'inherit' }}>
                        {item.ordered_qty}
                      </td>
                      <td style={{ textAlign: 'right', color: item.received_qty > 0 ? 'var(--secondary)' : 'inherit' }}>
                        {item.received_qty}
                      </td>
                      <td style={{ textAlign: 'right', color: item.consumed_qty > 0 ? 'var(--accent)' : 'inherit' }}>
                        {item.consumed_qty}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.stock_balance > 0 ? 'var(--success)' : 'inherit' }}>
                        {item.stock_balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {workflow.length > 5 && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <Link href="/boq" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', fontSize: '0.9rem' }}>
                    View All {workflow.length} BOQ Items →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Project Details</h2>
          <div style={{ fontSize: '0.9rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>CLIENT</span>
              <strong>{activeProject.client}</strong>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>CONSULTANT</span>
              <strong>{activeProject.consultant}</strong>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>SITE LOCATION</span>
              <span>{activeProject.site_location}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>START DATE</span>
                <strong>{activeProject.start_date || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600' }}>END DATE</span>
                <strong>{activeProject.end_date || 'N/A'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
