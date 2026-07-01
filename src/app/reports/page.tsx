'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { db } from '@/lib/db';

export default function ReportsPage() {
  const { activeProject, activeProjectId } = useProject();
  
  const [asOfDate, setAsOfDate] = useState<string>('');
  const [vatView, setVatView] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [reportData, setReportData] = useState<any>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [receivedData, setReceivedData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'financial' | 'stock' | 'wastage' | 'received'>('financial');

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const calculateReport = () => {
    if (activeProjectId) {
      const summary = db.getFinancialCostSummary(activeProjectId, asOfDate || undefined);
      setReportData(summary);

      const workflow = db.getBOQWorkflowSummary(activeProjectId);
      setStockData(workflow);

      const received = db.getReceivedItemsReport(activeProjectId);
      setReceivedData(received);
    }
  };

  useEffect(() => {
    calculateReport();
  }, [activeProjectId, asOfDate]);

  if (!activeProject) {
    return <div className="card">Please select a project to view Reports.</div>;
  }

  // Helper to resolve value based on VAT toggle
  const val = (item: { excl: number; vat: number; incl: number }) => {
    if (!item) return '0.000';
    const amount = vatView === 'inclusive' ? item.incl : item.excl;
    return amount.toLocaleString('en-US', { minimumFractionDigits: 3 });
  };

  // Helper to resolve VAT only (useful for transparency)
  const vatVal = (item: { excl: number; vat: number; incl: number }) => {
    if (!item) return '0.000';
    return item.vat.toLocaleString('en-US', { minimumFractionDigits: 3 });
  };

  // Helper to compute local rates
  const getRate = (rate: number, vatRate: number = 5) => {
    const factor = vatView === 'inclusive' ? (1 + vatRate / 100) : 1;
    return rate * factor;
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="page-title-group">
          <h1>Reporting Module</h1>
          <p>Analyze PO commitments, receipts, stock utilization, and BOQ balances</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* VAT Inclusive/Exclusive toggle */}
          <div className="vat-toggle-container">
            <span>VAT View:</span>
            <button
              onClick={() => setVatView('exclusive')}
              className={`btn ${vatView === 'exclusive' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              Excl. VAT
            </button>
            <button
              onClick={() => setVatView('inclusive')}
              className={`btn ${vatView === 'inclusive' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
            >
              Incl. VAT (5%)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>As of Date:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="form-control"
              style={{ width: '160px', padding: '0.35rem 0.5rem' }}
            />
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('financial')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'financial' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'financial' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          📊 Financial Cost Summary
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'stock' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'stock' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          📦 Site Stock Report
        </button>
        <button
          onClick={() => setActiveTab('wastage')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'wastage' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'wastage' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          ⚠️ Wastage Report
        </button>
        <button
          onClick={() => setActiveTab('received')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'received' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'received' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          📥 Received at Site Report
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'financial' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Operational Project Value Summary
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Approved BOQ Value</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated total contract budget</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700' }}>
                  OMR {val(reportData?.boq_total)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>PO Issued Value</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value of issued purchase orders</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary)' }}>
                  OMR {val(reportData?.po_issued)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Material Received Value (GRN)</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value of stock delivered to site</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--secondary)' }}>
                  OMR {val(reportData?.received)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Material Consumed Value</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value of stock issued to locations & wasted</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--accent)' }}>
                  OMR {val(reportData?.used)}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Balance Liabilities & Commitments
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Remaining Committed Value</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ordered on PO but not yet received (GRN)</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--success)' }}>
                  OMR {val(reportData?.remaining_committed)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Remaining BOQ Value</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved budget not yet ordered via POs</span>
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--danger)' }}>
                  OMR {val(reportData?.remaining_boq)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-hover)' }}>Total 5% VAT Component</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cumulative tax obligation on issued POs</span>
                </div>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-hover)' }}>
                  OMR {vatVal(reportData?.po_issued)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (() => {
        const filtered = stockData.filter(item => 
          item.stock_balance > 0 && (
            item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );

        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>📦 Site Stock Availability & Valuation</h2>
              <input
                type="text"
                placeholder="🔍 Search item code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ width: '280px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>
            <div className="table-container">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Total Received</th>
                    <th style={{ textAlign: 'right' }}>Total Issued</th>
                    <th style={{ textAlign: 'right' }}>Total Wasted</th>
                    <th style={{ textAlign: 'right' }}>On-Site Balance</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Stock Value</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No matching items found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => {
                      const rate = getRate(item.unit_rate, item.vat_rate);
                      const stockVal = item.stock_balance * rate;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                          <td>{item.description}</td>
                          <td><span className="badge badge-draft">{item.unit}</span></td>
                          <td style={{ textAlign: 'right' }}>{item.received_qty}</td>
                          <td style={{ textAlign: 'right' }}>{item.consumed_qty}</td>
                          <td style={{ textAlign: 'right' }}>{item.wastage_qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: item.stock_balance > 0 ? 'var(--success)' : 'inherit' }}>
                            {item.stock_balance}
                          </td>
                          <td style={{ textAlign: 'right' }}>{rate.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{stockVal.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                          <td style={{ textAlign: 'center' }}>
                            {item.stock_balance > 0 ? (
                              <span className="badge badge-received">In Stock</span>
                            ) : (
                              <span className="badge badge-draft">Out of Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab === 'wastage' && (() => {
        const filtered = stockData.filter(i => i.wastage_qty > 0).filter(item => 
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>⚠️ Material Wastage Analysis</h2>
              <input
                type="text"
                placeholder="🔍 Search item code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ width: '280px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>
            <div className="table-container">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Received Qty</th>
                    <th style={{ textAlign: 'right' }}>Wasted Qty</th>
                    <th style={{ textAlign: 'right' }}>Wastage Rate (%)</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Wastage Cost</th>
                    <th style={{ textAlign: 'center' }}>Status Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {stockData.filter(i => i.wastage_qty > 0).length === 0 
                          ? "Excellent! No material wastage has been recorded for this project."
                          : "No matching items found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => {
                      const rate = getRate(item.unit_rate, item.vat_rate);
                      const wasteVal = item.wastage_qty * rate;
                      const percent = item.received_qty > 0 ? (item.wastage_qty / item.received_qty) * 100 : 0;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                          <td>{item.description}</td>
                          <td><span className="badge badge-draft">{item.unit}</span></td>
                          <td style={{ textAlign: 'right' }}>{item.received_qty}</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{item.wastage_qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: '500', color: percent > 8 ? 'var(--danger)' : 'inherit' }}>
                            {percent.toFixed(2)}%
                          </td>
                          <td style={{ textAlign: 'right' }}>{rate.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--danger)' }}>
                            {wasteVal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {percent > 8 ? (
                              <span className="badge badge-danger">High Wastage</span>
                            ) : (
                              <span className="badge badge-issued">Acceptable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab === 'received' && (() => {
        const filtered = receivedData.filter(item => 
          item.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.delivery_note_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.received_by.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>📥 Material Site Deliveries (GRN Log)</h2>
              <input
                type="text"
                placeholder="🔍 Search GRN, DN, PO, item code, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ width: '320px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              />
            </div>
            <div className="table-container">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>GRN Number</th>
                    <th>Received Date</th>
                    <th>Received By</th>
                    <th>PO Reference</th>
                    <th>Item Code</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Received Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Received Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {receivedData.length === 0 
                          ? "No material arrivals (GRNs) have been recorded yet."
                          : "No matching items found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => {
                      const rate = getRate(item.unit_rate);
                      const valAmount = item.qty_received * rate;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>
                            <div>{item.grn_number}</div>
                            {item.delivery_note_number && (
                              <div style={{ fontSize: '0.72rem', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '2px' }}>
                                DN: {item.delivery_note_number}
                              </div>
                            )}
                          </td>
                          <td>{item.received_date}</td>
                          <td>{item.received_by}</td>
                          <td><span className="badge badge-issued">{item.po_number}</span></td>
                          <td style={{ fontWeight: '500' }}>{item.item_code}</td>
                          <td>{item.description}</td>
                          <td><span className="badge badge-draft">{item.unit}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: '500' }}>{item.qty_received}</td>
                          <td style={{ textAlign: 'right' }}>{rate.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>
                            {valAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Visual walkthrough comparison card */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Audit Log & Reconciliation Advice</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          This summary lists all committed values based on {activeProject.name} settings.
          Under Oman VAT Executive Regulations, VAT is calculated on the transaction date when either the tax invoice is issued, the goods/services are delivered, or payment is received, whichever occurs first. 
          Use the <strong>VAT View Toggle</strong> to swap between operational cost auditing (excluding VAT) and tax liability verification (including 5% VAT).
        </p>
      </div>
    </div>
  );
}
