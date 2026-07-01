'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { canWrite } = useAuth();
  const isAdmin = canWrite('users'); // Check if current user has Admin privileges

  const [company, setCompany] = useState({
    name: '',
    address: '',
    vat_number: '',
    cr_number: '',
    logo: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const details = db.getCompanyDetails();
    setCompany(details);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompany(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCompany(prev => ({
        ...prev,
        logo: reader.result as string
      }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.saveCompanyDetails(company);
      setMessage('Company details updated successfully! Reloading page to apply updates...');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update company details');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>⚙️ System Settings</h1>
          <p>Configure company profiles, VAT details, and upload print report logos</p>
        </div>
      </div>

      {message && (
        <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--success)', fontWeight: '600' }}>
          ✓ {message}
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--danger)', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Company Profile</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Company Legal Name</label>
              <input
                type="text"
                name="name"
                value={company.name}
                onChange={handleChange}
                className="form-control"
                disabled={!isAdmin}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">VAT Identification Number (Oman VAT)</label>
              <input
                type="text"
                name="vat_number"
                value={company.vat_number}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g. OM1100XXXXX"
                disabled={!isAdmin}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Commercial Registration Number (CR No)</label>
              <input
                type="text"
                name="cr_number"
                value={company.cr_number}
                onChange={handleChange}
                className="form-control"
                disabled={!isAdmin}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Logo (Click to change)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden'
                }}>
                  {company.logo ? (
                    <img src={company.logo} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>🏢</span>
                  )}
                </div>
                {isAdmin && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ fontSize: '0.8rem' }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Company Address</label>
            <textarea
              name="address"
              value={company.address}
              onChange={handleChange}
              className="form-control"
              rows={3}
              disabled={!isAdmin}
              required
            />
          </div>

          {isAdmin ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                Save Settings
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>
              ℹ️ Only Administrator accounts can edit company profile details.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
