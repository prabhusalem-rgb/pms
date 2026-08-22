'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { db, Project } from '@/lib/db';

export default function ProjectsPage() {
  const { projects, refreshProjects } = useProject();
  const [showModal, setShowModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    consultant: '',
    site_location: '',
    currency: 'OMR',
    vat_rate: 5.0,
    cr_number: '',
    vat_number: '',
    start_date: '',
    end_date: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'vat_rate' ? parseFloat(value) || 0 : value
    }));
  };

  const handleCreateClick = () => {
    setEditingProjectId(null);
    setFormData({
      name: '',
      client: '',
      consultant: '',
      site_location: '',
      currency: 'OMR',
      vat_rate: 5.0,
      cr_number: '',
      vat_number: '',
      start_date: '',
      end_date: ''
    });
    setShowModal(true);
  };

  const handleEditClick = (project: Project) => {
    setEditingProjectId(project.id);
    setFormData({
      name: project.name,
      client: project.client,
      consultant: project.consultant,
      site_location: project.site_location,
      currency: project.currency,
      vat_rate: project.vat_rate,
      cr_number: project.cr_number,
      vat_number: project.vat_number,
      start_date: project.start_date || '',
      end_date: project.end_date || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = (projectId: string, projectName: string) => {
    try {
      // Pre-check validation before confirming
      const boqItems = db.getBOQWorkflowSummary ? db.getBOQWorkflowSummary(projectId) : [];
      const clientBOQItems = db.getClientBOQItems ? db.getClientBOQItems(projectId) : [];
      if (boqItems.length > 0 || clientBOQItems.length > 0) {
        alert("This project cannot be deleted because it contains Bill of Quantities (BOQ) items. Please delete all BOQ items first.");
        return;
      }

      if (window.confirm(`Are you sure you want to delete the project "${projectName}"? This will permanently delete all associated BOQ items, POs, GRNs, and material issues.`)) {
        if (window.confirm(`⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting the project "${projectName}" and all its related records?`)) {
          db.deleteProject(projectId);
          refreshProjects();
        }
      }
    } catch (error: any) {
      alert(error.message || "An error occurred while trying to delete the project.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveProject(editingProjectId ? { ...formData, id: editingProjectId } : formData);
    setFormData({
      name: '',
      client: '',
      consultant: '',
      site_location: '',
      currency: 'OMR',
      vat_rate: 5.0,
      cr_number: '',
      vat_number: '',
      start_date: '',
      end_date: ''
    });
    setEditingProjectId(null);
    setShowModal(false);
    refreshProjects();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Project Configurations</h1>
          <p>Manage and configure Oman-standard multi-project setups</p>
        </div>
        <button onClick={handleCreateClick} className="btn btn-primary">
          + Create Project
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {projects.map((project) => {
          const stats = db.getFinancialCostSummary(project.id);
          return (
            <div key={project.id} className="card" style={{ borderTop: '5px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{project.name}</h2>
                  <span className="badge badge-issued">{project.currency}</span>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <div><strong>Client:</strong> {project.client}</div>
                  <div><strong>Consultant:</strong> {project.consultant}</div>
                  <div><strong>Location:</strong> {project.site_location}</div>
                  <div><strong>VAT Reg:</strong> {project.vat_number || 'Not Registered'}</div>
                  <div><strong>Dates:</strong> {project.start_date || 'N/A'} to {project.end_date || 'N/A'}</div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Budget (Excl. VAT)</span>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>
                      OMR {stats?.boq_total?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>PO Value (Excl. VAT)</span>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--secondary)' }}>
                      OMR {stats?.po_issued?.excl.toLocaleString('en-US', { minimumFractionDigits: 3 }) || '0.000'}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
                  <button 
                    onClick={() => handleEditClick(project)} 
                    className="btn btn-outline" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(project.id, project.name)} 
                    className="btn btn-danger" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', background: 'var(--danger)', color: 'white', border: 'none' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingProjectId ? 'Edit Project' : 'Create New Project'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                  placeholder="e.g. Al Khuwair Commercial Tower"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Client Name</label>
                  <input
                    type="text"
                    name="client"
                    value={formData.client}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consultant Name</label>
                  <input
                    type="text"
                    name="consultant"
                    value={formData.consultant}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Site Location</label>
                <input
                  type="text"
                  name="site_location"
                  value={formData.site_location}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                  placeholder="e.g., Bowsher, Muscat, Oman"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">VAT Reg Number</label>
                  <input
                    type="text"
                    name="vat_number"
                    value={formData.vat_number}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="e.g. OM-VAT-99229"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="form-control"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default VAT Rate (%)</label>
                  <input
                    type="number"
                    name="vat_rate"
                    value={formData.vat_rate}
                    onChange={handleInputChange}
                    className="form-control"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="form-control"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
