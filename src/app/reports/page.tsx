'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { db } from '@/lib/db';
import { exportToExcel } from '@/lib/excelExport';
import { useAuth } from '@/context/AuthContext';

export default function ReportsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { currentUser } = useAuth();
  
  const [asOfDate, setAsOfDate] = useState<string>('');
  const [vatView, setVatView] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [reportData, setReportData] = useState<any>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [receivedData, setReceivedData] = useState<any[]>([]);
  const [costVariationData, setCostVariationData] = useState<any[]>([]);
  const [dbProject, setDbProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'financial' | 'stock' | 'wastage' | 'received' | 'cost-variation'>('financial');

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

      const variation = db.getCostVariationReport(activeProjectId);
      setCostVariationData(variation);

      const proj = db.getProjects().find(p => p.id === activeProjectId);
      setDbProject(proj || null);
    }
  };

  useEffect(() => {
    calculateReport();
    return db.subscribe(() => {
      calculateReport();
    });
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

  const exportFinancialSummary = () => {
    const dataToExport = [
      {
        metric: 'Approved BOQ Value (Estimated total contract budget)',
        excl: reportData?.boq_total?.excl ?? 0,
        vat: reportData?.boq_total?.vat ?? 0,
        incl: reportData?.boq_total?.incl ?? 0
      },
      {
        metric: 'PO Issued Value (Value of issued purchase orders)',
        excl: reportData?.po_issued?.excl ?? 0,
        vat: reportData?.po_issued?.vat ?? 0,
        incl: reportData?.po_issued?.incl ?? 0
      },
      {
        metric: 'Material Received Value (GRN) (Value of stock delivered to site)',
        excl: reportData?.received?.excl ?? 0,
        vat: reportData?.received?.vat ?? 0,
        incl: reportData?.received?.incl ?? 0
      },
      {
        metric: 'Material Consumed Value (Value of stock issued to locations & wasted)',
        excl: reportData?.used?.excl ?? 0,
        vat: reportData?.used?.vat ?? 0,
        incl: reportData?.used?.incl ?? 0
      },
      {
        metric: 'Remaining Committed Value (Ordered on PO but not yet received)',
        excl: reportData?.remaining_committed?.excl ?? 0,
        vat: reportData?.remaining_committed?.vat ?? 0,
        incl: reportData?.remaining_committed?.incl ?? 0
      },
      {
        metric: 'Remaining BOQ Value (Approved budget not yet ordered via POs)',
        excl: reportData?.remaining_boq?.excl ?? 0,
        vat: reportData?.remaining_boq?.vat ?? 0,
        incl: reportData?.remaining_boq?.incl ?? 0
      }
    ];

    exportToExcel(
      `Financial_Cost_Summary_${activeProject?.name || 'Project'}.xls`,
      'Financial Summary',
      [
        { header: 'Cost Metric Description', key: 'metric', width: 45 },
        { header: 'Amount Excl. VAT', key: 'excl', width: 18, type: 'currency' },
        { header: 'VAT Component (5%)', key: 'vat', width: 18, type: 'currency' },
        { header: 'Amount Incl. VAT', key: 'incl', width: 18, type: 'currency' }
      ],
      dataToExport
    );
  };

  const exportSiteStock = () => {
    const filtered = stockData.filter(item => item.stock_balance > 0);
    const dataToExport = filtered.map(item => {
      const rate = getRate(item.unit_rate, item.vat_rate);
      const stockVal = item.stock_balance * rate;
      return {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        received_qty: parseFloat(item.received_qty.toFixed(2)),
        consumed_qty: parseFloat(item.consumed_qty.toFixed(2)),
        wastage_qty: parseFloat(item.wastage_qty.toFixed(2)),
        stock_balance: parseFloat(item.stock_balance.toFixed(2)),
        rate: rate,
        stock_val: stockVal,
        status: item.stock_balance > 0 ? 'In Stock' : 'Out of Stock'
      };
    });

    exportToExcel(
      `Site_Stock_Report_${activeProject?.name || 'Project'}.xls`,
      'Site Stock',
      [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Total Received', key: 'received_qty', width: 15, type: 'number' },
        { header: 'Total Issued', key: 'consumed_qty', width: 15, type: 'number' },
        { header: 'Total Wasted', key: 'wastage_qty', width: 15, type: 'number' },
        { header: 'On-Site Balance', key: 'stock_balance', width: 18, type: 'number' },
        { header: `Unit Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'rate', width: 18, type: 'currency' },
        { header: 'Stock Value', key: 'stock_val', width: 18, type: 'currency' },
        { header: 'Status', key: 'status', width: 15 }
      ],
      dataToExport
    );
  };

  const exportWastageReport = () => {
    const filtered = stockData.filter(i => i.wastage_qty > 0);
    const dataToExport = filtered.map(item => {
      const rate = getRate(item.unit_rate, item.vat_rate);
      const wasteVal = item.wastage_qty * rate;
      const percent = item.received_qty > 0 ? (item.wastage_qty / item.received_qty) * 100 : 0;
      return {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        received_qty: parseFloat(item.received_qty.toFixed(2)),
        wastage_qty: parseFloat(item.wastage_qty.toFixed(2)),
        percent: percent,
        rate: rate,
        waste_val: wasteVal,
        status: percent > 8 ? 'High Wastage' : 'Acceptable'
      };
    });

    exportToExcel(
      `Wastage_Report_${activeProject?.name || 'Project'}.xls`,
      'Wastage Analysis',
      [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Received Qty', key: 'received_qty', width: 15, type: 'number' },
        { header: 'Wasted Qty', key: 'wastage_qty', width: 15, type: 'number' },
        { header: 'Wastage Rate (%)', key: 'percent', width: 18, type: 'percent' },
        { header: `Unit Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'rate', width: 18, type: 'currency' },
        { header: 'Wastage Cost', key: 'waste_val', width: 18, type: 'currency' },
        { header: 'Status Alert', key: 'status', width: 15 }
      ],
      dataToExport
    );
  };

  const exportReceivedReport = () => {
    const dataToExport = receivedData.map(item => {
      const rate = getRate(item.unit_rate);
      const valAmount = item.qty_received * rate;
      return {
        grn_number: item.grn_number,
        delivery_note: item.delivery_note_number || 'N/A',
        received_date: item.received_date,
        received_by: item.received_by,
        po_number: item.po_number,
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        qty_received: parseFloat(item.qty_received.toFixed(2)),
        rate: rate,
        val_amount: valAmount
      };
    });

    exportToExcel(
      `Received_At_Site_Report_${activeProject?.name || 'Project'}.xls`,
      'Site Deliveries Log',
      [
        { header: 'GRN Number', key: 'grn_number', width: 18 },
        { header: 'Delivery Note', key: 'delivery_note', width: 18 },
        { header: 'Received Date', key: 'received_date', width: 15, type: 'date' },
        { header: 'Received By', key: 'received_by', width: 15 },
        { header: 'PO Reference', key: 'po_number', width: 15 },
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Received Qty', key: 'qty_received', width: 15, type: 'number' },
        { header: `Unit Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'rate', width: 18, type: 'currency' },
        { header: 'Received Value', key: 'val_amount', width: 18, type: 'currency' }
      ],
      dataToExport
    );
  };

  const exportCostVariationReport = () => {
    const dataToExport = costVariationData.map(item => {
      const boqRate = getRate(item.unit_rate, item.vat_rate);
      const boqTotal = item.approved_qty * boqRate;
      const purchaseRate = item.avg_purchase_rate > 0 ? getRate(item.avg_purchase_rate, item.vat_rate) : 0;
      const orderedTotal = item.ordered_qty * purchaseRate;
      
      const varianceQty = item.variance_qty;
      const varianceRate = item.ordered_qty > 0 ? getRate(item.variance_rate, item.vat_rate) : 0;
      const priceVariance = getRate(item.price_variance, item.vat_rate);
      const qtyVariance = getRate(item.qty_variance, item.vat_rate);
      const totalCostVariance = getRate(item.total_cost_variance, item.vat_rate);
      
      let status = 'No Purchase';
      if (item.ordered_qty > 0) {
        if (totalCostVariance > 0.001) status = 'Over Budget';
        else if (totalCostVariance < -0.001) status = 'Under Budget';
        else status = 'On Budget';
      }

      return {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        approved_qty: parseFloat(item.approved_qty.toFixed(2)),
        boq_rate: boqRate,
        boq_total: boqTotal,
        ordered_qty: parseFloat(item.ordered_qty.toFixed(2)),
        avg_purchase_rate: purchaseRate,
        ordered_total: orderedTotal,
        variance_qty: varianceQty,
        variance_rate: varianceRate,
        price_variance: priceVariance,
        qty_variance: qtyVariance,
        total_cost_variance: totalCostVariance,
        status: status
      };
    });

    exportToExcel(
      `Cost_Variation_Report_${activeProject?.name || 'Project'}.xls`,
      'Cost Variation',
      [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'BOQ Qty', key: 'approved_qty', width: 15, type: 'number' },
        { header: `BOQ Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'boq_rate', width: 18, type: 'currency' },
        { header: `BOQ Total (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'boq_total', width: 18, type: 'currency' },
        { header: 'Purchased Qty', key: 'ordered_qty', width: 15, type: 'number' },
        { header: `Avg Purchase Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'avg_purchase_rate', width: 22, type: 'currency' },
        { header: `Purchase Total (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'ordered_total', width: 20, type: 'currency' },
        { header: 'Variance Qty', key: 'variance_qty', width: 15, type: 'number' },
        { header: `Variance Rate (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'variance_rate', width: 22, type: 'currency' },
        { header: `Price Variance (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'price_variance', width: 20, type: 'currency' },
        { header: `Quantity Variance (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'qty_variance', width: 20, type: 'currency' },
        { header: `Total Cost Variance (${vatView === 'inclusive' ? 'Incl.' : 'Excl.'} VAT)`, key: 'total_cost_variance', width: 22, type: 'currency' },
        { header: 'Status', key: 'status', width: 15 }
      ],
      dataToExport
    );
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
        <button
          onClick={() => setActiveTab('cost-variation')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'cost-variation' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'cost-variation' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          💸 Cost Variation Report
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'financial' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={exportFinancialSummary} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem', height: 'auto', minHeight: 'unset' }}>
              📥 Export Financial Summary (Excel)
            </button>
          </div>
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
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button onClick={exportSiteStock} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.8rem', height: 'auto', minHeight: 'unset' }}>
                  📥 Export to Excel
                </button>
                <input
                  type="text"
                  placeholder="🔍 Search item code or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ width: '280px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
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
                          <td style={{ textAlign: 'right' }}>{item.received_qty.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{item.consumed_qty.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{item.wastage_qty.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: item.stock_balance > 0 ? 'var(--success)' : 'inherit' }}>
                            {item.stock_balance.toFixed(2)}
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
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button onClick={exportWastageReport} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.8rem', height: 'auto', minHeight: 'unset' }}>
                  📥 Export to Excel
                </button>
                <input
                  type="text"
                  placeholder="🔍 Search item code or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ width: '280px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
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
                          <td style={{ textAlign: 'right' }}>{item.received_qty.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{item.wastage_qty.toFixed(2)}</td>
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
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button onClick={exportReceivedReport} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.8rem', height: 'auto', minHeight: 'unset' }}>
                  📥 Export to Excel
                </button>
                <input
                  type="text"
                  placeholder="🔍 Search GRN, DN, PO, item code, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ width: '320px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
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
                          <td style={{ textAlign: 'right', fontWeight: '500' }}>{item.qty_received.toFixed(2)}</td>
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

      {activeTab === 'cost-variation' && (() => {
        const isApproved = !!dbProject?.boq_approved;

        if (!isApproved) {
          return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center', gap: '1.5rem' }}>
              <div style={{ fontSize: '3rem' }}>🔒</div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.5rem' }}>Cost Sheet BOQ Not Approved</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  The Cost Variation Report can only be calculated once the Cost Sheet BOQ has been approved. Approving the BOQ freezes the baseline quantity and unit rates for cost variation analysis.
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (activeProjectId) {
                    db.approveBOQ(activeProjectId, currentUser?.username || 'System User');
                    calculateReport();
                  }
                }}
                style={{ padding: '0.6rem 2rem', fontWeight: '600' }}
              >
                ✔️ Approve Cost Sheet BOQ
              </button>
            </div>
          );
        }

        const filtered = costVariationData.filter(item => 
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const isKumaresan = currentUser?.username?.toLowerCase() === 'kumaresan';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>✅</span>
                <div>
                  <strong style={{ color: '#065f46', fontSize: '0.9rem', display: 'block' }}>Cost Sheet BOQ Approved & Frozen</strong>
                  <span style={{ fontSize: '0.78rem', color: '#047857' }}>
                    Approved by <strong>{dbProject.boq_approved_by}</strong> on {new Date(dbProject.boq_approved_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                {isKumaresan ? (
                  <button 
                    className="btn btn-outline" 
                    onClick={() => {
                      if (activeProjectId) {
                        try {
                          db.undoApproveBOQ(activeProjectId, currentUser?.username || 'kumaresan');
                          calculateReport();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.4rem 1rem', fontSize: '0.82rem', background: '#fff' }}
                  >
                    ↩️ Undo Approval
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#047857', fontStyle: 'italic' }}>
                    (Only user 'kumaresan' can undo approval)
                  </span>
                )}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>💸 Cost Variation Report (BOQ vs Purchase Order Prices)</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button onClick={exportCostVariationReport} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.8rem', height: 'auto', minHeight: 'unset' }}>
                    📥 Export to Excel
                  </button>
                  <input
                    type="text"
                    placeholder="🔍 Search item code or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-control"
                    style={{ width: '280px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>BOQ Qty</th>
                      <th style={{ textAlign: 'right' }}>BOQ Rate</th>
                      <th style={{ textAlign: 'right' }}>BOQ Budget</th>
                      <th style={{ textAlign: 'right' }}>Purchased Qty</th>
                      <th style={{ textAlign: 'right' }}>Avg Purchase Rate</th>
                      <th style={{ textAlign: 'right' }}>Purchased Cost</th>
                      <th style={{ textAlign: 'right' }}>Variance Qty</th>
                      <th style={{ textAlign: 'right' }}>Variance Rate</th>
                      <th style={{ textAlign: 'right' }}>Price Var Cost</th>
                      <th style={{ textAlign: 'right' }}>Qty Var Cost</th>
                      <th style={{ textAlign: 'right' }}>Total Cost Variance</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No items found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item, idx) => {
                        const boqRate = getRate(item.unit_rate, item.vat_rate);
                        const boqTotal = item.approved_qty * boqRate;
                        const purchaseRate = item.avg_purchase_rate > 0 ? getRate(item.avg_purchase_rate, item.vat_rate) : 0;
                        const orderedTotal = item.ordered_qty * purchaseRate;
                        
                        const varianceQty = item.variance_qty;
                        const varianceRate = item.ordered_qty > 0 ? getRate(item.variance_rate, item.vat_rate) : 0;
                        const priceVariance = getRate(item.price_variance, item.vat_rate);
                        const qtyVariance = getRate(item.qty_variance, item.vat_rate);
                        const totalCostVariance = getRate(item.total_cost_variance, item.vat_rate);

                        let statusBadge = <span className="badge badge-draft">No Purchase</span>;
                        if (item.ordered_qty > 0) {
                          if (totalCostVariance > 0.001) {
                            statusBadge = <span className="badge badge-danger">Over Budget</span>;
                          } else if (totalCostVariance < -0.001) {
                            statusBadge = <span className="badge badge-received">Under Budget</span>;
                          } else {
                            statusBadge = <span className="badge badge-issued">On Budget</span>;
                          }
                        }

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                            <td>{item.description}</td>
                            <td><span className="badge badge-draft">{item.unit}</span></td>
                            <td style={{ textAlign: 'right' }}>{item.approved_qty.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{boqRate.toFixed(3)}</td>
                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{boqTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                            <td style={{ textAlign: 'right' }}>{item.ordered_qty.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{item.ordered_qty > 0 ? purchaseRate.toFixed(3) : '-'}</td>
                            <td style={{ textAlign: 'right' }}>{item.ordered_qty > 0 ? orderedTotal.toLocaleString('en-US', { minimumFractionDigits: 3 }) : '-'}</td>
                            <td style={{ 
                              textAlign: 'right',
                              color: varianceQty > 0.001 ? 'var(--danger)' : (varianceQty < -0.001 ? 'var(--success)' : 'inherit'),
                              fontWeight: varianceQty !== 0 ? '600' : 'normal'
                            }}>
                              {(varianceQty > 0 ? '+' : '') + varianceQty.toFixed(2)}
                            </td>
                            <td style={{ 
                              textAlign: 'right',
                              color: varianceRate > 0.001 ? 'var(--danger)' : (varianceRate < -0.001 ? 'var(--success)' : 'inherit'),
                              fontWeight: varianceRate !== 0 ? '600' : 'normal'
                            }}>
                              {item.ordered_qty > 0 ? (varianceRate > 0 ? '+' : '') + varianceRate.toFixed(3) : '-'}
                            </td>
                            <td style={{ 
                              textAlign: 'right', 
                              color: priceVariance > 0.001 ? 'var(--danger)' : (priceVariance < -0.001 ? 'var(--success)' : 'inherit'),
                              fontWeight: priceVariance !== 0 ? '600' : 'normal'
                            }}>
                              {item.ordered_qty > 0 ? priceVariance.toLocaleString('en-US', { minimumFractionDigits: 3 }) : '-'}
                            </td>
                            <td style={{ 
                              textAlign: 'right',
                              color: qtyVariance > 0.001 ? 'var(--danger)' : (qtyVariance < -0.001 ? 'var(--success)' : 'inherit'),
                              fontWeight: qtyVariance !== 0 ? '600' : 'normal'
                            }}>
                              {qtyVariance.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                            <td style={{ 
                              textAlign: 'right',
                              color: totalCostVariance > 0.001 ? 'var(--danger)' : (totalCostVariance < -0.001 ? 'var(--success)' : 'inherit'),
                              fontWeight: totalCostVariance !== 0 ? '700' : 'normal'
                            }}>
                              {totalCostVariance.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>{statusBadge}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
