'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { db, ActivityLog, ZohoSettings } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { isAdmin, currentUser } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'profile' | 'logs' | 'zoho'>('profile');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnv, setFilterEnv] = useState<'all' | 'prod' | 'staging' | 'dev'>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const [company, setCompany] = useState({
    name: '',
    address: '',
    vat_number: '',
    cr_number: '',
    logo: ''
  });

  const [zohoSettings, setZohoSettings] = useState<ZohoSettings>({
    clientId: '',
    clientSecret: '',
    organizationId: '',
    region: 'com',
    accessToken: null,
    refreshToken: null,
    expiryTime: null,
    materialAccountName: '',
    subcontractAccountName: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterEnv, filterAuthor, filterDate]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);

  useEffect(() => {
    const loadSettings = () => {
      const details = db.getCompanyDetails();
      setCompany(details);
      const activityLogs = db.getActivityLogs();
      setLogs(activityLogs);
      const zoho = db.getZohoSettings();
      setZohoSettings(zoho);
    };
    loadSettings();
    return db.subscribe(() => {
      loadSettings();
    });
  }, []);

  const codeExchangedRef = React.useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('zoho_code');
    const zohoError = urlParams.get('zoho_error');

    if (zohoError) {
      setError(`Zoho Authentication Error: ${zohoError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code) {
      if (codeExchangedRef.current) return;
      codeExchangedRef.current = true;

      const currentSettings = db.getZohoSettings();
      if (!currentSettings.clientId || !currentSettings.clientSecret) {
        setError('Client credentials missing in settings. Please save them before connecting.');
        return;
      }

      setMessage('Exchanging authorization code for tokens...');
      const redirectUri = window.location.origin + '/api/integrations/zoho/callback';

      fetch('/api/integrations/zoho/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          clientId: currentSettings.clientId,
          clientSecret: currentSettings.clientSecret,
          region: currentSettings.region || 'com',
          redirectUri
        }),
      })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Token exchange failed');
        }

        const expiryTime = Date.now() + (data.expiresIn * 1000);
        db.saveZohoSettings({
          ...currentSettings,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiryTime
        });

        setMessage('Successfully connected to Zoho Books!');
        setActiveTab('zoho');
        setTimeout(() => setMessage(''), 3000);
      })
      .catch((err) => {
        setError(`Failed to connect Zoho Books: ${err.message}`);
      })
      .finally(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newLog, setNewLog] = useState({
    change_summary: '',
    user_name: '',
    user_id: '',
    user_role: '',
    timestamp: '',
    environment: 'staging' as 'prod' | 'staging' | 'dev',
    before_filename: '',
    before_desc: '',
    after_filename: '',
    after_desc: '',
    fields_changed: [] as { field: string; oldValue: string; newValue: string }[],
    reason_or_ticket: '',
    rollback_instructions: '',
    verification_steps: '',
  });

  const [fieldInput, setFieldInput] = useState({ field: '', oldValue: '', newValue: '' });

  const handleAddField = () => {
    if (!fieldInput.field) return;
    setNewLog(prev => ({
      ...prev,
      fields_changed: [...prev.fields_changed, { ...fieldInput }]
    }));
    setFieldInput({ field: '', oldValue: '', newValue: '' });
  };

  const handleRemoveField = (index: number) => {
    setNewLog(prev => ({
      ...prev,
      fields_changed: prev.fields_changed.filter((_, i) => i !== index)
    }));
  };

  const openAddLogModal = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    const offset = - (new Date()).getTimezoneOffset();
    const diff = offset >= 0 ? '+' : '-';
    const pad = (num: number) => (num < 10 ? '0' : '') + num;
    const timezone = diff + pad(Math.floor(Math.abs(offset) / 60)) + ':' + pad(Math.abs(offset) % 60);
    const formattedTimestamp = localISOTime + timezone;

    setNewLog({
      change_summary: '',
      user_name: currentUser?.username || 'Admin User',
      user_id: currentUser?.id || 'admin-default',
      user_role: currentUser?.role || 'Admin',
      timestamp: formattedTimestamp,
      environment: 'staging',
      before_filename: '',
      before_desc: '',
      after_filename: '',
      after_desc: '',
      fields_changed: [],
      reason_or_ticket: '',
      rollback_instructions: '',
      verification_steps: '',
    });
    setShowAddModal(true);
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.saveActivityLog({
        change_summary: newLog.change_summary,
        user_details: {
          name: newLog.user_name,
          userId: newLog.user_id,
          role: newLog.user_role
        },
        timestamp: newLog.timestamp,
        environment: newLog.environment,
        before_screenshot: {
          filename: newLog.before_filename || 'N/A',
          description: newLog.before_desc || 'N/A'
        },
        after_screenshot: {
          filename: newLog.after_filename || 'N/A',
          description: newLog.after_desc || 'N/A'
        },
        fields_changed: newLog.fields_changed,
        reason_or_ticket: newLog.reason_or_ticket,
        rollback_instructions: newLog.rollback_instructions,
        verification_steps: newLog.verification_steps
      });
      setLogs(db.getActivityLogs());
      setShowAddModal(false);
      setMessage('Activity log entry added successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save activity log');
    }
  };

  const handleDeleteLog = (id: string) => {
    if (confirm('Are you sure you want to delete this activity log?')) {
      db.deleteActivityLog(id);
      setLogs(db.getActivityLogs());
    }
  };

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

  const handleZohoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setZohoSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveZoho = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.saveZohoSettings(zohoSettings);
      setMessage('Zoho Books settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save Zoho settings');
    }
  };

  const handleConnectZoho = () => {
    if (!zohoSettings.clientId || !zohoSettings.organizationId) {
      setError('Please fill in Client ID and Organization ID first.');
      return;
    }
    db.saveZohoSettings(zohoSettings); // save current state first
    const redirectUri = window.location.origin + '/api/integrations/zoho/callback';
    const region = zohoSettings.region || 'com';
    const authUrl = `https://accounts.zoho.${region}/oauth/v2/auth?scope=ZohoBooks.fullaccess.all&client_id=${zohoSettings.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  // Get unique authors
  const uniqueAuthors = Array.from(new Set(logs.map(log => log.user_details.name))).sort();

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.change_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_details.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason_or_ticket.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEnv = filterEnv === 'all' || log.environment === filterEnv;
    const matchesAuthor = filterAuthor === 'all' || log.user_details.name === filterAuthor;
    
    let matchesDate = true;
    if (filterDate !== 'all') {
      const logDate = new Date(log.timestamp);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (filterDate === 'today') {
        matchesDate = logDate >= today;
      } else if (filterDate === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = logDate >= sevenDaysAgo;
      } else if (filterDate === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = logDate >= thirtyDaysAgo;
      }
    }
    return matchesSearch && matchesEnv && matchesAuthor && matchesDate;
  });

  const itemsPerPage = 25;
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!isAdmin) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>⚙️ System Settings</h1>
          <p>Configure company profiles, VAT details, and view system change logs</p>
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

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            color: activeTab === 'profile' ? '#6366f1' : 'var(--text-muted)',
            borderBottom: activeTab === 'profile' ? '3px solid #6366f1' : '3px solid transparent',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          🏢 Company Profile
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            color: activeTab === 'logs' ? '#6366f1' : 'var(--text-muted)',
            borderBottom: activeTab === 'logs' ? '3px solid #6366f1' : '3px solid transparent',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          📋 Activity Logs
        </button>
        <button
          onClick={() => setActiveTab('zoho')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            color: activeTab === 'zoho' ? '#6366f1' : 'var(--text-muted)',
            borderBottom: activeTab === 'zoho' ? '3px solid #6366f1' : '3px solid transparent',
            fontWeight: '700',
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          💰 Zoho Books Integration
        </button>
      </div>

      {activeTab === 'profile' ? (
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
      ) : activeTab === 'zoho' ? (
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Zoho Books Configuration</h2>
          <form onSubmit={handleSaveZoho}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Client ID</label>
                <input
                  type="text"
                  name="clientId"
                  value={zohoSettings.clientId || ''}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Client Secret</label>
                <input
                  type="password"
                  name="clientSecret"
                  value={zohoSettings.clientSecret || ''}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  required
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Organization ID</label>
                <input
                  type="text"
                  name="organizationId"
                  value={zohoSettings.organizationId || ''}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>API Region</label>
                <select
                  name="region"
                  value={zohoSettings.region || 'com'}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--card-bg)' }}
                >
                  <option value="com">United States (.com)</option>
                  <option value="eu">Europe (.eu)</option>
                  <option value="in">India (.in)</option>
                  <option value="com.cn">China (.com.cn)</option>
                  <option value="jp">Japan (.jp)</option>
                  <option value="com.au">Australia (.com.au)</option>
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', marginTop: '1.5rem' }}>Account Mapping</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Material Purchase Account (Purchase Orders)</label>
                <input
                  type="text"
                  name="materialAccountName"
                  value={zohoSettings.materialAccountName || ''}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  placeholder="e.g. Purchase of Items for Projects"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>Subcontract Work Account (Work Orders)</label>
                <input
                  type="text"
                  name="subcontractAccountName"
                  value={zohoSettings.subcontractAccountName || ''}
                  onChange={handleZohoChange}
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                  placeholder="e.g. Outsourced Works"
                />
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Connection Status</h3>
              {zohoSettings.refreshToken ? (
                <div>
                  <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span> Connected to Zoho Books
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Access token expires at: {zohoSettings.expiryTime ? new Date(zohoSettings.expiryTime).toLocaleString() : 'N/A'}
                  </p>
                </div>
              ) : (
                <div>
                  <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span> Disconnected
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    You must authorize the application with Zoho Books to begin syncing.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <button type="button" onClick={handleConnectZoho} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔗 Connect & Authorize Zoho
              </button>
              <button type="submit" className="btn btn-primary">
                Save Credentials
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Controls row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search logs by summary, user, ticket..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: '1 1 200px',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <select
                value={filterEnv}
                onChange={e => setFilterEnv(e.target.value as any)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #e2e8f0)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Environments</option>
                <option value="prod">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Development</option>
              </select>
              <select
                value={filterAuthor}
                onChange={e => setFilterAuthor(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #e2e8f0)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Authors</option>
                {uniqueAuthors.map(author => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
              <select
                value={filterDate}
                onChange={e => setFilterDate(e.target.value as any)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #e2e8f0)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={openAddLogModal}>
              + Add Log Entry
            </button>
          </div>

          {/* Logs List Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Timestamp</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', width: '100px' }}>Env</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Change Summary</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', width: '150px' }}>Author</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const envColor = log.environment === 'prod' 
                      ? { bg: 'rgba(239,68,68,0.12)', color: '#f87171' } 
                      : log.environment === 'staging' 
                        ? { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' } 
                        : { bg: 'rgba(56,189,248,0.12)', color: '#38bdf8' };

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: envColor.bg,
                            color: envColor.color
                          }}>
                            {log.environment}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {log.change_summary}
                          {log.reason_or_ticket && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#818cf8', marginTop: '0.15rem' }}>
                              🎫 {log.reason_or_ticket}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                          <div style={{ fontWeight: '600' }}>{log.user_details.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_details.role}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: '600' }}
                            >
                              👁 View
                            </button>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: '600' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: 'rgba(255,255,255,0.01)',
                borderTop: '1px solid var(--border)',
                fontSize: '0.85rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  Showing <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)}
                  </span> to <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {Math.min(currentPage * itemsPerPage, filteredLogs.length)}
                  </span> of <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    {filteredLogs.length}
                  </span> logs
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      opacity: currentPage === 1 ? 0.5 : 1,
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ◀ Previous
                  </button>
                  <span style={{ margin: '0 0.5rem' }}>
                    Page <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{currentPage}</span> of <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{totalPages}</span>
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Details Modal (Formatted as a compact bullet list) */}
      {selectedLog && (
        <div className="overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '95%' }}>
            <div className="modal-header">
              <h2>📋 Activity Log Details</h2>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                <li><strong>Change Summary:</strong> {selectedLog.change_summary}</li>
                <li><strong>User details:</strong> {selectedLog.user_details.name} (ID: <code>{selectedLog.user_details.userId}</code>, Role: {selectedLog.user_details.role})</li>
                <li><strong>Timestamp:</strong> <code>{selectedLog.timestamp}</code></li>
                <li>
                  <strong>Environment:</strong>{' '}
                  <span style={{
                    textTransform: 'uppercase',
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: selectedLog.environment === 'prod' ? 'rgba(239,68,68,0.15)' : selectedLog.environment === 'staging' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)',
                    color: selectedLog.environment === 'prod' ? '#f87171' : selectedLog.environment === 'staging' ? '#fbbf24' : '#38bdf8'
                  }}>
                    {selectedLog.environment}
                  </span>
                </li>
                <li><strong>Before Screenshot:</strong> {selectedLog.before_screenshot.filename} — {selectedLog.before_screenshot.description}</li>
                <li><strong>After Screenshot:</strong> {selectedLog.after_screenshot.filename} — {selectedLog.after_screenshot.description}</li>
                <li>
                  <strong>Fields Changed:</strong>
                  {selectedLog.fields_changed.length === 0 ? ' None' : (
                    <ul style={{ listStyleType: 'circle', paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                      {selectedLog.fields_changed.map((f, i) => (
                        <li key={i}>
                          <code>{f.field}</code>: <code>{f.oldValue}</code> ➔ <code>{f.newValue}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
                <li><strong>Reason or Ticket Reference:</strong> {selectedLog.reason_or_ticket || 'None'}</li>
                <li><strong>Rollback Instructions:</strong> {selectedLog.rollback_instructions || 'None'}</li>
                <li><strong>Verification Steps:</strong> <span style={{ whiteSpace: 'pre-line' }}>{selectedLog.verification_steps}</span></li>
              </ul>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Log Modal */}
      {showAddModal && (
        <div className="overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '95%' }}>
            <div className="modal-header">
              <h2>➕ Add Activity Log Entry</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveLog}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
                
                <div className="form-group">
                  <label className="form-label">Change Summary *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Brief description of what was changed"
                    value={newLog.change_summary}
                    onChange={e => setNewLog(prev => ({ ...prev, change_summary: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">User Name *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={newLog.user_name}
                      onChange={e => setNewLog(prev => ({ ...prev, user_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">User ID *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={newLog.user_id}
                      onChange={e => setNewLog(prev => ({ ...prev, user_id: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">User Role *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={newLog.user_role}
                      onChange={e => setNewLog(prev => ({ ...prev, user_role: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Timestamp (ISO 8601) *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={newLog.timestamp}
                      onChange={e => setNewLog(prev => ({ ...prev, timestamp: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Environment *</label>
                    <select
                      className="form-control"
                      value={newLog.environment}
                      onChange={e => setNewLog(prev => ({ ...prev, environment: e.target.value as any }))}
                    >
                      <option value="dev">Development (dev)</option>
                      <option value="staging">Staging (staging)</option>
                      <option value="prod">Production (prod)</option>
                    </select>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#818cf8' }}>Before Screenshot</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Filename (e.g. before.png)"
                      className="form-control"
                      value={newLog.before_filename}
                      onChange={e => setNewLog(prev => ({ ...prev, before_filename: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="Short Description"
                      className="form-control"
                      value={newLog.before_desc}
                      onChange={e => setNewLog(prev => ({ ...prev, before_desc: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#818cf8' }}>After Screenshot</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Filename (e.g. after.png)"
                      className="form-control"
                      value={newLog.after_filename}
                      onChange={e => setNewLog(prev => ({ ...prev, after_filename: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="Short Description"
                      className="form-control"
                      value={newLog.after_desc}
                      onChange={e => setNewLog(prev => ({ ...prev, after_desc: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Fields Changed Dynamic Input */}
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#818cf8' }}>Fields Changed (Optional)</h4>
                  {newLog.fields_changed.length > 0 && (
                    <table style={{ width: '100%', marginBottom: '0.75rem', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ textAlign: 'left', padding: '0.25rem' }}>Field</th>
                          <th style={{ textAlign: 'left', padding: '0.25rem' }}>Old Value</th>
                          <th style={{ textAlign: 'left', padding: '0.25rem' }}>New Value</th>
                          <th style={{ width: '30px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newLog.fields_changed.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.25rem' }}><code>{f.field}</code></td>
                            <td style={{ padding: '0.25rem' }}><code>{f.oldValue}</code></td>
                            <td style={{ padding: '0.25rem' }}><code>{f.newValue}</code></td>
                            <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                              <button type="button" onClick={() => handleRemoveField(i)} style={{ border: 'none', background: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Field Name"
                      className="form-control"
                      value={fieldInput.field}
                      onChange={e => setFieldInput(prev => ({ ...prev, field: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="Old Value"
                      className="form-control"
                      value={fieldInput.oldValue}
                      onChange={e => setFieldInput(prev => ({ ...prev, oldValue: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="New Value"
                      className="form-control"
                      value={fieldInput.newValue}
                      onChange={e => setFieldInput(prev => ({ ...prev, newValue: e.target.value }))}
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleAddField} style={{ padding: '0.45rem 0.75rem' }}>
                      Add Row
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Ticket Reference *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. [SEC-409] Restrict settings panel"
                    value={newLog.reason_or_ticket}
                    onChange={e => setNewLog(prev => ({ ...prev, reason_or_ticket: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rollback Instructions</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Instructions to rollback this change"
                    value={newLog.rollback_instructions}
                    onChange={e => setNewLog(prev => ({ ...prev, rollback_instructions: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Verification Steps *</label>
                  <textarea
                    required
                    className="form-control"
                    rows={3}
                    placeholder="Steps taken to verify this change"
                    value={newLog.verification_steps}
                    onChange={e => setNewLog(prev => ({ ...prev, verification_steps: e.target.value }))}
                  />
                </div>

              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Save Log Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
