'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { db, Supplier } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { zohoClient } from '@/lib/zoho';

export default function SuppliersPage() {
  const { canWrite } = useAuth();
  const canEditSuppliers = canWrite('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Material Supplier' | 'Subcontractor'>('All');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  
  // Zoho Sync indicators
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleSyncToZoho = async (id: string) => {
    setSyncingId(id);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      await zohoClient.syncSupplier(id);
      setSyncSuccess('Supplier synced to Zoho Books successfully!');
      setTimeout(() => setSyncSuccess(null), 3000);
    } catch (err: any) {
      setSyncError(`Failed to sync: ${err.message}`);
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setSyncingId(null);
    }
  };

  const handleRefreshAllFromZoho = async () => {
    const linkedSuppliers = suppliers.filter(s => !!s.zoho_contact_id);
    if (linkedSuppliers.length === 0) {
      alert('No suppliers are currently linked/synced to Zoho Books.');
      return;
    }

    setIsRefreshingAll(true);
    setSyncError(null);
    setSyncSuccess(null);

    let successCount = 0;
    let failCount = 0;

    for (const s of linkedSuppliers) {
      try {
        await zohoClient.refreshSupplierDetails(s.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to refresh supplier ${s.name}:`, err);
        failCount++;
      }
    }

    setIsRefreshingAll(false);
    loadSuppliers();

    if (failCount === 0) {
      setSyncSuccess(`Successfully refreshed details for all ${successCount} Zoho suppliers!`);
      setTimeout(() => setSyncSuccess(null), 4000);
    } else {
      setSyncError(`Refreshed ${successCount} suppliers; ${failCount} failed. Check console for details.`);
      setTimeout(() => setSyncError(null), 6000);
    }
  };
  
  // Supplier Details Sub-window State
  const [selectedDetailSupplier, setSelectedDetailSupplier] = useState<Supplier | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'Material Supplier' as 'Material Supplier' | 'Subcontractor' | 'Both',
    contact_person: '',
    email: '',
    phone: '',
    cr_number: '',
    vat_number: '',
    address: ''
  });

  const loadSuppliers = () => {
    setSuppliers(db.getSuppliers());
  };

  useEffect(() => {
    loadSuppliers();
    return db.subscribe(() => {
      loadSuppliers();
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddClick = () => {
    setEditingSupplierId(null);
    setFormData({
      name: '',
      type: 'Material Supplier',
      contact_person: '',
      email: '',
      phone: '',
      cr_number: '',
      vat_number: '',
      address: ''
    });
    setShowModal(true);
  };

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setFormData({
      name: supplier.name,
      type: supplier.type,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      cr_number: supplier.cr_number || '',
      vat_number: supplier.vat_number || '',
      address: supplier.address || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the supplier "${name}"?`)) {
      if (window.confirm(`⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting the supplier "${name}"?`)) {
        db.deleteSupplier(id);
        loadSuppliers();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveSupplier(editingSupplierId ? { ...formData, id: editingSupplierId } : formData);
    setShowModal(false);
    loadSuppliers();
  };

  const downloadTemplate = () => {
    const headers = ['name', 'type', 'contact_person', 'email', 'phone', 'cr_number', 'vat_number', 'address'];
    const sampleRows = [
      ['Al Turki Enterprises LLC', 'Material Supplier', 'Salim Al-Harthy', 'salim@alturki.com', '+968 99112233', '1029384', 'OM1100029348', 'Al Khuwair, Muscat, Oman'],
      ['Alcon Subcontracting', 'Subcontractor', 'Kumar Das', 'kumar@alcon.om', '+968 98765432', '2019283', 'OM2200038472', 'Industrial Area, Salalah, Oman']
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.map(v => `"${v.replace(/'/g, '\'\'')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'suppliers_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          throw new Error('CSV is empty or missing headers');
        }

        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const parsedItems: any[] = [];
        const errors: string[] = [];

        const currentSuppliers = db.getSuppliers();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values: string[] = [];
          let currentField = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentField.trim().replace(/^["']|["']$/g, ''));
              currentField = '';
            } else {
              currentField += char;
            }
          }
          values.push(currentField.trim().replace(/^["']|["']$/g, ''));

          if (values.length < headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          const getVal = (colName: string) => {
            const idx = headers.indexOf(colName);
            return idx >= 0 ? values[idx] : '';
          };

          const name = getVal('name');
          const typeStr = getVal('type');
          const contact_person = getVal('contact_person');
          const email = getVal('email');
          const phone = getVal('phone');
          const cr_number = getVal('cr_number');
          const vat_number = getVal('vat_number');
          const address = getVal('address');

          if (!name) {
            errors.push(`Row ${i + 1}: Name is required`);
            continue;
          }

          let type: 'Material Supplier' | 'Subcontractor' | 'Both' = 'Material Supplier';
          if (typeStr.toLowerCase().includes('both') || (typeStr.toLowerCase().includes('material') && typeStr.toLowerCase().includes('sub'))) {
            type = 'Both';
          } else if (typeStr.toLowerCase().includes('sub') || typeStr.toLowerCase().includes('labour')) {
            type = 'Subcontractor';
          }

          const existing = currentSuppliers.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim());

          parsedItems.push({
            id: existing ? existing.id : undefined,
            is_update: !!existing,
            name,
            type,
            contact_person,
            email,
            phone,
            cr_number,
            vat_number,
            address
          });
        }

        setImportPreview(parsedItems);
        setImportErrors(errors);
        setShowImportModal(true);
      } catch (err) {
        setImportErrors([`Failed to parse CSV: ${(err as Error).message}`]);
        setShowImportModal(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = () => {
    importPreview.forEach(item => {
      const { is_update, ...savePayload } = item;
      db.saveSupplier(savePayload);
    });
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    loadSuppliers();
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'All' || supplier.type === typeFilter || supplier.type === 'Both';

    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Supplier & Partner Management</h1>
          <p>Register and maintain credentials for Material Suppliers and Subcontractors</p>
        </div>
        {canEditSuppliers && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={handleRefreshAllFromZoho} 
              disabled={isRefreshingAll} 
              className="btn btn-outline" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: '#10b981', color: '#10b981' }}
            >
              {isRefreshingAll ? '🔄 Refreshing...' : '🔄 Refresh All Zoho'}
            </button>
            <button onClick={downloadTemplate} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📥 Download Template
            </button>
            <label className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0 }}>
              📤 Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button onClick={handleAddClick} className="btn btn-primary">
              + Add Supplier
            </button>
          </div>
        )}
      </div>

      {syncSuccess && (
        <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--success)', fontWeight: '600' }}>
          ✓ {syncSuccess}
        </div>
      )}

      {syncError && (
        <div style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--danger)', fontWeight: '600' }}>
          ⚠️ {syncError}
        </div>
      )}

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label className="form-label">Search Suppliers</label>
            <input
              type="text"
              placeholder="Search by name, contact, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
            />
          </div>
          <div>
            <label className="form-label">Filter by Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="form-control"
            >
              <option value="All">All Partners</option>
              <option value="Material Supplier">Material Suppliers</option>
              <option value="Subcontractor">Subcontractors</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card">
        {filteredSuppliers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <h3>No Suppliers Found</h3>
            <p>Click "+ Add Supplier" to register a new supplier or subcontractor.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Contact Person</th>
                  <th>Contact Details</th>
                  <th>Tax Identifications</th>
                  <th>Zoho Status</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <span 
                        onClick={() => {
                          setDetailSearchQuery('');
                          setSelectedDetailSupplier(supplier);
                        }}
                        style={{ 
                          fontWeight: '700', 
                          color: 'var(--primary)', 
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-hover)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--primary)'}
                      >
                        {supplier.name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${supplier.type === 'Subcontractor' ? 'badge-draft' : 'badge-issued'}`}>
                        {supplier.type}
                      </span>
                    </td>
                    <td>{supplier.contact_person || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {supplier.email && <div>✉ {supplier.email}</div>}
                        {supplier.phone && <div>📞 {supplier.phone}</div>}
                        {supplier.address && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>📍 {supplier.address}</div>}
                        {!supplier.email && !supplier.phone && !supplier.address && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>
                        <div><strong>CR No:</strong> {supplier.cr_number || 'N/A'}</div>
                        <div><strong>VAT:</strong> {supplier.vat_number || 'N/A'}</div>
                      </div>
                    </td>
                    <td>
                      {supplier.zoho_contact_id ? (
                        <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #137333', fontSize: '0.75rem' }}>
                          Synced ({supplier.zoho_contact_id})
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #c5221f', fontSize: '0.75rem' }}>
                          Not Synced
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {canEditSuppliers && (
                          <button
                            onClick={() => handleSyncToZoho(supplier.id)}
                            disabled={syncingId === supplier.id}
                            className="btn btn-outline"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              height: 'auto',
                              minHeight: 'unset',
                              borderColor: '#6366f1',
                              color: '#6366f1'
                            }}
                          >
                            {syncingId === supplier.id ? 'Syncing...' : 'Sync Zoho'}
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClick(supplier)}
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(supplier.id, supplier.name)}
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', color: '#ef4444', borderColor: '#fee2e2' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSupplierId ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Supplier / Partner Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                  placeholder="e.g., Al Turki Enterprises LLC"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Partner Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="Material Supplier">Material Supplier</option>
                  <option value="Subcontractor">Subcontractor / Labour Partner</option>
                  <option value="Both">Both (Material & Subcontractor)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="e.g., Salim Al-Harthy"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="e.g., info@alturki.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="e.g., +968 24XXXXXX"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">CR No (Commercial Registration Number)</label>
                  <input
                    type="text"
                    name="cr_number"
                    value={formData.cr_number}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="e.g. 1029384"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">VAT registration Number (Oman)</label>
                  <input
                    type="text"
                    name="vat_number"
                    value={formData.vat_number}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="e.g. OM1100029348"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Office / Business Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="e.g. Office 42, Building 10, Muscat, Oman"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupplierId ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
            <div className="modal-header" style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
              <h2 className="modal-title">Confirm Supplier CSV Import</h2>
              <button className="close-btn" onClick={() => {
                setShowImportModal(false);
                setImportPreview([]);
                setImportErrors([]);
              }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              {importErrors.length > 0 && (
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.3rem' }}>⚠️ Validation Warnings / Errors:</strong>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.length > 0 ? (
                <div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Successfully parsed <strong>{importPreview.length}</strong> partners. Preview the items below before confirming:
                  </p>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Supplier Name</th>
                          <th>Type</th>
                          <th>Contact Person</th>
                          <th>Contact Details</th>
                          <th>Registration Info (CR / VAT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              {item.is_update ? (
                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>Update</span>
                              ) : (
                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>New</span>
                              )}
                            </td>
                            <td style={{ fontWeight: '600' }}>{item.name}</td>
                            <td>
                              <span className={`badge ${item.type === 'Subcontractor' ? 'badge-draft' : 'badge-issued'}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>{item.contact_person || '-'}</td>
                            <td>
                              <div style={{ fontSize: '0.75rem' }}>
                                {item.email && <div>✉ {item.email}</div>}
                                {item.phone && <div>📞 {item.phone}</div>}
                                {item.address && <div>📍 {item.address}</div>}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.75rem' }}>
                                <div>CR No: {item.cr_number || 'N/A'}</div>
                                <div>VAT: {item.vat_number || 'N/A'}</div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                importErrors.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No valid rows found in the CSV.
                  </p>
                )
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview([]);
                  setImportErrors([]);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                className="btn btn-primary"
                disabled={importPreview.length === 0}
              >
                Confirm & Import {importPreview.length} Partners
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Performance Detail Sub-window ── */}
      {selectedDetailSupplier && (() => {
        const supplierPos = db.getPOs().filter(po => po.supplier_id === selectedDetailSupplier.id);
        
        // Compile all items ordered vs received from this supplier
        const itemsSummary: Record<string, { description: string; ordered: number; received: number; unit: string }> = {};
        
        supplierPos.forEach(po => {
          const poLines = db.getPOLines(po.id);
          const grns = db.getGRNs().filter(g => g.po_id === po.id);
          
          poLines.forEach(pol => {
            const cleanDesc = pol.description.trim();
            
            // Find unit from BOQ matching if available
            const matchingBOQ = db.getBOQItems().find(b => b.description.trim() === cleanDesc);
            const unit = matchingBOQ ? matchingBOQ.unit : 'Unit';

            if (!itemsSummary[cleanDesc]) {
              itemsSummary[cleanDesc] = { description: pol.description, ordered: 0, received: 0, unit };
            }
            itemsSummary[cleanDesc].ordered += pol.qty;
            
            // Calculate received qty
            grns.forEach(grn => {
              const grnLines = db.getGRNLines(grn.id);
              const matchingGrnLine = grnLines.find(gl => gl.po_line_id === pol.id);
              if (matchingGrnLine) {
                itemsSummary[cleanDesc].received += matchingGrnLine.qty_received;
              }
            });
          });
        });

        return (
          <div className="overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 1100 }} onClick={() => setSelectedDetailSupplier(null)}>
            <div 
              className="modal-content" 
              onClick={e => e.stopPropagation()} 
              style={{ maxWidth: '850px', width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '2rem', borderRadius: '16px' }}
            >
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                    🏢 {selectedDetailSupplier.name} Performance
                  </h2>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Supplier Type: <strong>{selectedDetailSupplier.type}</strong> | Contact: {selectedDetailSupplier.contact_person || 'N/A'}
                    {selectedDetailSupplier.address && ` | Address: ${selectedDetailSupplier.address}`}
                  </p>
                </div>
                <button className="close-btn" onClick={() => setSelectedDetailSupplier(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingRight: '0.5rem' }}>
                
                {/* section 1: PO Status Summary */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-hover)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📄 Purchase Orders Issued ({supplierPos.length})
                  </h3>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>PO Number</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Description / Project</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>Retention %</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', width: '150px' }}>Current Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierPos.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                              No Purchase Orders recorded for this supplier.
                            </td>
                          </tr>
                        ) : (
                          supplierPos.map(po => {
                            const project = db.getProjects().find(p => p.id === po.project_id);
                            
                            // Map badge classes
                            let badgeClass = 'badge-draft';
                            if (po.status === 'issued') badgeClass = 'badge-issued';
                            if (po.status === 'partially_received') badgeClass = 'badge-received';
                            if (po.status === 'closed') badgeClass = 'badge-closed';

                            return (
                              <tr key={po.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '0.6rem 0.9rem', fontWeight: '700' }}>{po.po_number}</td>
                                <td style={{ padding: '0.6rem 0.9rem' }}>
                                  <div style={{ fontWeight: '500' }}>{po.description || 'No description'}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🏢 Project: {project?.name || 'Unknown'}</div>
                                </td>
                                <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>
                                  {po.retention_percent > 0 ? `${po.retention_percent}%` : '0%'}
                                </td>
                                <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                                  <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                                    {po.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* section 2: Items Delivered and Received status */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--secondary-hover)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📦 Materials Delivered & Receipt Progress
                  </h3>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Item Description</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>Ordered Qty</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>Received Qty</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>Balance Qty</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '140px' }}>Delivery Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(itemsSummary).length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                              No items received from this supplier yet.
                            </td>
                          </tr>
                        ) : (
                          Object.values(itemsSummary).map((item, idx) => {
                            const percent = item.ordered > 0 ? Math.min(100, (item.received / item.ordered) * 100) : 0;
                            const balance = Math.max(0, item.ordered - item.received);
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '0.6rem 0.9rem', fontWeight: '500' }}>{item.description}</td>
                                <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>
                                  {item.ordered.toFixed(3)} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{item.unit}</span>
                                </td>
                                <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--secondary)' }}>
                                  {item.received.toFixed(3)} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{item.unit}</span>
                                </td>
                                <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: balance > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                                  {balance.toFixed(3)} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{item.unit}</span>
                                </td>
                                <td style={{ padding: '0.6rem 0.9rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '70px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: percent >= 100 ? 'var(--success)' : 'var(--primary)' }} />
                                    </div>
                                    <span style={{ fontWeight: '600', fontSize: '0.72rem', minWidth: '30px', textAlign: 'right' }}>
                                      {percent.toFixed(0)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* section 3: Detailed Purchase History with Search Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      💰 Detailed Items Purchased & Unit Prices
                    </h3>
                    <input
                      type="text"
                      placeholder="🔍 Search purchased items..."
                      value={detailSearchQuery}
                      onChange={e => setDetailSearchQuery(e.target.value)}
                      className="form-control"
                      style={{ width: '240px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', height: 'auto' }}
                    />
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>PO Number</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Item Description</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '100px' }}>Qty</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>Unit Rate</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '120px' }}>VAT (%)</th>
                          <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)', width: '130px' }}>Total (Excl.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allPurchasedLines: any[] = [];
                          supplierPos.forEach(po => {
                            const poLines = db.getPOLines(po.id);
                            poLines.forEach(l => {
                              allPurchasedLines.push({
                                po_number: po.po_number,
                                description: l.description,
                                qty: l.qty,
                                unit_rate: l.unit_rate,
                                vat_rate: l.vat_rate
                              });
                            });
                          });

                          const filteredLines = allPurchasedLines.filter(line =>
                            line.description.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
                            line.po_number.toLowerCase().includes(detailSearchQuery.toLowerCase())
                          );

                          if (filteredLines.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                                  No matching purchased items found.
                                </td>
                              </tr>
                            );
                          }

                          return filteredLines.map((line, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <td style={{ padding: '0.6rem 0.9rem', fontWeight: '600' }}>
                                <span className="badge badge-issued">{line.po_number}</span>
                              </td>
                              <td style={{ padding: '0.6rem 0.9rem', fontWeight: '500' }}>{line.description}</td>
                              <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{line.qty.toFixed(3)}</td>
                              <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: 'var(--primary-hover)', fontWeight: '600' }}>
                                OMR {line.unit_rate.toFixed(3)}
                              </td>
                              <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: 'var(--text-muted)' }}>{line.vat_rate}%</td>
                              <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: '700' }}>
                                OMR {(line.qty * line.unit_rate).toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
                <button className="btn btn-outline" onClick={() => setSelectedDetailSupplier(null)}>
                  Close Sub-window
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
