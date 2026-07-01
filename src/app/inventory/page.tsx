'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { db, PurchaseOrder, GoodsReceiptNote, MaterialIssue, BOQItem, PurchaseOrderLine, Supplier } from '@/lib/db';

export default function InventoryPage() {
  const { activeProject, activeProjectId } = useProject();
  const { canWrite } = useAuth();
  const canEditInventory = canWrite('inventory');
  
  const [activeTab, setActiveTab] = useState<'stock' | 'grn' | 'issue'>('stock');
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [boqWorkflow, setBoqWorkflow] = useState<any[]>([]);
  
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  
  // GRN State
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [editingGrnId, setEditingGrnId] = useState<string | null>(null);
  const [printGRN, setPrintGRN] = useState<GoodsReceiptNote | null>(null);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poLines, setPoLines] = useState<PurchaseOrderLine[]>([]);
  const [grnHeader, setGrnHeader] = useState({
    grn_number: '',
    received_by: '',
    delivery_note_number: '',
    received_date: new Date().toISOString().split('T')[0]
  });
  const [grnQuantities, setGrnQuantities] = useState<Record<string, number>>({});

  // GRN Supplier search & select state
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnSupplierSearchQuery, setGrnSupplierSearchQuery] = useState('');
  const [showGrnSupplierDropdown, setShowGrnSupplierDropdown] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Expanded GRN Row State
  const [expandedGrnId, setExpandedGrnId] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  // Issue State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueHeader, setIssueHeader] = useState({
    issue_number: '',
    issued_to_location: '',
    issued_by: '',
    issue_date: new Date().toISOString().split('T')[0]
  });
  const [issueLines, setIssueLines] = useState<Array<{
    boq_item_id: string;
    qty_issued: number;
    qty_wastage: number;
  }>>([{ boq_item_id: '', qty_issued: 0, qty_wastage: 0 }]);
  
  // MIN Material Search and Select Dropdown States
  const [issueSearchQueries, setIssueSearchQueries] = useState<Record<number, string>>({});
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  const loadData = () => {
    if (activeProjectId) {
      setPos(db.getPOs(activeProjectId).filter(po => po.status === 'issued' || po.status === 'partially_received'));
      setBoqWorkflow(db.getBOQWorkflowSummary(activeProjectId));
      setGrns(db.getGRNs(activeProjectId));
      setIssues(db.getMaterialIssues(activeProjectId));
      setSuppliers(db.getSuppliers());
      
      // Auto-generate doc numbers
      const nextGrn = db.getGRNs().length + 1;
      const nextIssue = db.getMaterialIssues().length + 1;
      setGrnHeader(prev => ({
        ...prev,
        grn_number: `GRN-${2026}-${String(nextGrn).padStart(4, '0')}`
      }));
      setIssueHeader(prev => ({
        ...prev,
        issue_number: `MIN-${2026}-${String(nextIssue).padStart(4, '0')}`
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProjectId]);

  // Handle PO Selection in GRN
  useEffect(() => {
    if (selectedPOId) {
      const lines = db.getPOLines(selectedPOId);
      setPoLines(lines);
      // Initialize receipt quantities to 0
      const initialQtys: Record<string, number> = {};
      lines.forEach(l => {
        // Calculate previously received quantity for balance tracking
        const allGrns = db.getGRNs(activeProjectId || '');
        let previouslyReceived = 0;
        allGrns.forEach(g => {
          const gLines = db.getGRNLines(g.id);
          const matchingLine = gLines.find(gl => gl.po_line_id === l.id);
          if (matchingLine) {
            previouslyReceived += matchingLine.qty_received;
          }
        });
        
        // Initial received now value
        initialQtys[l.id] = 0;
      });
      setGrnQuantities(initialQtys);
    } else {
      setPoLines([]);
      setGrnQuantities({});
    }
  }, [selectedPOId, activeProjectId]);

  // Reset PO choice if supplier selection changes
  useEffect(() => {
    setSelectedPOId('');
    setPoLines([]);
    setGrnQuantities({});
  }, [grnSupplierId]);

  const handleGRNQtyChange = (lineId: string, val: string) => {
    const qty = parseFloat(val) || 0;
    setGrnQuantities(prev => ({ ...prev, [lineId]: qty }));
  };

  const handleGRNSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !selectedPOId) return;

    // Prepare line data and validate against ordered quantity and balance
    const lines = [];
    for (const [poLineId, qtyReceived] of Object.entries(grnQuantities)) {
      const poLine = poLines.find(l => l.id === poLineId);
      if (poLine) {
        // Calculate already received quantity to determine true balance
        const allGrns = db.getGRNs(activeProjectId || '');
        let previouslyReceived = 0;
        allGrns.forEach(g => {
          const gLines = db.getGRNLines(g.id);
          const matchingLine = gLines.find(gl => gl.po_line_id === poLineId);
          if (matchingLine) {
            previouslyReceived += matchingLine.qty_received;
          }
        });
        
        const balanceQty = Math.max(0, poLine.qty - previouslyReceived);
        if (qtyReceived > balanceQty) {
          alert(`Error: Received quantity (${qtyReceived}) for item "${poLine.description}" exceeds the remaining PO balance quantity (${balanceQty}). Please correct the quantity.`);
          return;
        }
      }
      lines.push({
        po_line_id: poLineId,
        qty_received: qtyReceived
      });
    }

    db.saveGRN(
      {
        id: editingGrnId || undefined,
        grn_number: grnHeader.grn_number,
        po_id: selectedPOId,
        project_id: activeProjectId,
        received_by: grnHeader.received_by,
        received_date: grnHeader.received_date,
        delivery_note_number: grnHeader.delivery_note_number
      },
      lines
    );

    setShowGRNModal(false);
    setEditingGrnId(null);
    setSelectedPOId('');
    setGrnSupplierId('');
    setGrnSupplierSearchQuery('');
    loadData();
  };

  const handleIssueLineChange = (index: number, field: string, value: any) => {
    const updated = [...issueLines];
    let val = field === 'boq_item_id' ? value : parseFloat(value) || 0;
    
    // Strict Input Level Validation: Cap quantity to stock available
    if (field === 'qty_issued' && updated[index].boq_item_id) {
      const matched = boqWorkflow.find(b => b.id === updated[index].boq_item_id);
      const maxStock = matched ? matched.stock_balance : 0;
      if (val > maxStock) {
        alert(`Warning: Input quantity (${val.toFixed(3)}) exceeds the available stock of ${maxStock.toFixed(3)}. Automatically capping to maximum stock.`);
        val = maxStock;
      }
    }

    updated[index] = {
      ...updated[index],
      [field]: val
    };
    setIssueLines(updated);
  };

  const addIssueLine = () => {
    setIssueLines(prev => [...prev, { boq_item_id: '', qty_issued: 0, qty_wastage: 0 }]);
  };

  const removeIssueLine = (index: number) => {
    setIssueLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;

    // Strict validation: Verify no duplicate items are added in the MIN transaction
    const seenBOQItems = new Set<string>();
    for (const line of issueLines) {
      if (line.boq_item_id) {
        if (seenBOQItems.has(line.boq_item_id)) {
          const matched = boqWorkflow.find(b => b.id === line.boq_item_id) || db.getBOQWorkflowSummary(activeProjectId).find(b => b.id === line.boq_item_id);
          alert(`Error: Duplicate item detected: "${matched?.description || 'Item'}" is added multiple times. Please combine duplicate lines into a single line with cumulative quantities.`);
          return;
        }
        seenBOQItems.add(line.boq_item_id);
      }
    }

    // Strict validation: Verify qty_issued does not exceed stock balance
    for (const line of issueLines) {
      if (!line.boq_item_id) continue;
      const matched = boqWorkflow.find(b => b.id === line.boq_item_id) || db.getBOQWorkflowSummary(activeProjectId).find(b => b.id === line.boq_item_id);
      const stockAvailable = matched ? matched.stock_balance : 0;
      if (line.qty_issued > stockAvailable) {
        alert(`Error: Cannot issue ${line.qty_issued.toFixed(3)} for item "${matched?.description || 'Item'}". Only ${stockAvailable.toFixed(3)} units are currently available in stock. Please reduce the issued quantity.`);
        return;
      }
    }

    db.saveMaterialIssue(
      {
        issue_number: issueHeader.issue_number,
        project_id: activeProjectId,
        issue_date: issueHeader.issue_date,
        issued_to_location: issueHeader.issued_to_location,
        issued_by: issueHeader.issued_by
      },
      issueLines
    );

    setShowIssueModal(false);
    setIssueLines([{ boq_item_id: '', qty_issued: 0, qty_wastage: 0 }]);
    setIssueSearchQueries({});
    setActiveDropdownIndex(null);
    loadData();
  };

  const handleDeleteGRN = (id: string, grnNumber: string) => {
    if (window.confirm(`Are you sure you want to delete Goods Receipt Note "${grnNumber}"? This will reverse the received quantities back into the PO balance.`)) {
      db.deleteGRN(id);
      loadData();
    }
  };

  const handleDeleteIssue = (id: string, issueNumber: string) => {
    if (window.confirm(`Are you sure you want to delete Material Issue Note "${issueNumber}"? This will return the issued quantities back to the stock ledger.`)) {
      db.deleteMaterialIssue(id);
      loadData();
    }
  };

  if (!activeProject) {
    return <div className="card">Please select a project to manage inventory.</div>;
  }

  const handleEditGRNClick = (grn: GoodsReceiptNote) => {
    const po = db.getPOs().find(p => p.id === grn.po_id);
    if (!po) return;
    
    // Load PO supplier
    setGrnSupplierId(po.supplier_id);
    
    // Load PO lines first
    const lines = db.getPOLines(po.id);
    setPoLines(lines);

    // Populate current quantities
    const grnLines = db.getGRNLines(grn.id);
    const qtys: Record<string, number> = {};
    lines.forEach(l => {
      const match = grnLines.find(gl => gl.po_line_id === l.id);
      qtys[l.id] = match ? match.qty_received : 0;
    });

    setEditingGrnId(grn.id);
    setSelectedPOId(grn.po_id);
    setGrnHeader({
      grn_number: grn.grn_number,
      received_by: grn.received_by,
      delivery_note_number: grn.delivery_note_number || '',
      received_date: grn.received_date
    });
    setGrnQuantities(qtys);
    setShowGRNModal(true);
  };

  const handleRecordNewGRNClick = () => {
    setEditingGrnId(null);
    setSelectedPOId('');
    setGrnSupplierId('');
    setGrnQuantities({});
    const nextGrn = db.getGRNs().length + 1;
    setGrnHeader({
      grn_number: `GRN-${2026}-${String(nextGrn).padStart(4, '0')}`,
      received_by: '',
      delivery_note_number: '',
      received_date: new Date().toISOString().split('T')[0]
    });
    setShowGRNModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Site Module</h1>
          <p>Record arrivals, issue inventory to tasks, and track real-time stock levels</p>
        </div>
        {canEditInventory && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleRecordNewGRNClick} className="btn btn-primary">
              + Record Site GRN
            </button>
            <button onClick={() => setShowIssueModal(true)} className="btn btn-secondary">
              + Material Issue Note
            </button>
          </div>
        )}
      </div>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          Stock Ledger Balance
        </button>
        <button className={`tab-btn ${activeTab === 'grn' ? 'active' : ''}`} onClick={() => setActiveTab('grn')}>
          Receipts History (GRNs)
        </button>
        <button className={`tab-btn ${activeTab === 'issue' ? 'active' : ''}`} onClick={() => setActiveTab('issue')}>
          Site Issues History (MINs)
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Total Received</th>
                <th style={{ textAlign: 'right' }}>Total Consumed</th>
                <th style={{ textAlign: 'right' }}>Wastage Recorded</th>
                <th style={{ textAlign: 'right', fontWeight: 'bold' }}>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {boqWorkflow.filter(item => item.received_qty > 0 || item.consumed_qty > 0).length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No site material ledger transactions found. Click "Record Site GRN" to book arrivals.
                  </td>
                </tr>
              ) : (
                boqWorkflow
                  .filter(item => item.received_qty > 0 || item.consumed_qty > 0)
                  .map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                      <td>{item.description}</td>
                      <td><span className="badge badge-draft">{item.unit}</span></td>
                      <td style={{ textAlign: 'right', color: 'var(--secondary)' }}>{item.received_qty}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{item.consumed_qty}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{item.wastage_qty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.stock_balance > 0 ? 'var(--success)' : 'inherit' }}>
                        {item.stock_balance} {item.unit}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'grn' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>PO Reference</th>
                <th>Supplier / Partner</th>
                <th>Date Received</th>
                <th>Received By</th>
                <th style={{ textAlign: 'right' }}>Items Count</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {grns.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No Goods Receipt Notes recorded yet.
                  </td>
                </tr>
              ) : (
                grns.map((g) => {
                  const po = db.getPOs().find(p => p.id === g.po_id);
                  const supplier = po ? db.getSuppliers().find(s => s.id === po.supplier_id) : null;
                  const gLines = db.getGRNLines(g.id);
                  const isExpanded = expandedGrnId === g.id;
                  const activeGLines = gLines.filter(line => line.qty_received > 0);
                  return (
                    <React.Fragment key={g.id}>
                      <tr 
                        onClick={() => setExpandedGrnId(isExpanded ? null : g.id)}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#f8fafc' : 'transparent',
                          transition: 'background-color 0.2s',
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)'
                        }}
                        onMouseEnter={e => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = '#f1f5f9';
                        }}
                        onMouseLeave={e => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ fontWeight: '600' }}>
                          <span style={{ marginRight: '0.5rem', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>▶</span>
                          {g.grn_number}
                        </td>
                        <td>
                          <span className="badge badge-issued">{po?.po_number || 'N/A'}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '500' }}>{supplier?.name || 'N/A'}</span>
                        </td>
                        <td>{g.received_date}</td>
                        <td>{g.received_by}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                          {activeGLines.length} items (Click to {isExpanded ? 'Hide' : 'View'})
                        </td>
                        <td style={{ textAlign: 'center', minWidth: '220px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => setPrintGRN(g)}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', color: 'var(--primary)' }}
                            >
                              🖨️ PDF Report
                            </button>
                            {canEditInventory && (
                              <>
                                <button
                                  onClick={() => handleEditGRNClick(g)}
                                  className="btn btn-outline"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteGRN(g.id, g.grn_number)}
                                  className="btn btn-outline"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', color: '#ef4444', borderColor: '#fee2e2' }}
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 1rem 0.75rem 2rem', backgroundColor: '#f8fafc' }}>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', backgroundColor: 'white' }}>
                              <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', gap: '2rem' }}>
                                <span><strong>Supplier Delivery Note No:</strong> {g.delivery_note_number || 'N/A'}</span>
                              </div>
                              {(() => {
                                const activeLines = gLines.filter(line => line.qty_received > 0);
                                if (activeLines.length === 0) {
                                  return (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      No items received (all values 0) on this receipt.
                                    </div>
                                  );
                                }
                                return (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Received Item Name / Description</th>
                                        <th style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-muted)', width: '150px', fontWeight: '600' }}>Quantity Received</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {activeLines.map((line) => {
                                        // Find matching PO line globally
                                        const poLinesList = db.getPOLines();
                                        const poLine = poLinesList.find((pl: any) => pl.id === line.po_line_id);
                                        
                                        // If PO line is found, use it; otherwise check if the ID itself represents a BOQ item ID as a fallback
                                        let displayName = 'Linked PO Line Item';
                                        if (poLine) {
                                          displayName = poLine.description;
                                        } else {
                                          const boqItems = db.getBOQWorkflowSummary(activeProjectId || '');
                                          const matchingBOQ = boqItems.find((b: any) => b.id === line.po_line_id);
                                          if (matchingBOQ) {
                                            displayName = matchingBOQ.description;
                                          }
                                        }
                                        
                                        return (
                                          <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.5rem 1rem', color: 'var(--text-main)', fontWeight: '500' }}>
                                              {displayName}
                                            </td>
                                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--secondary)' }}>
                                              {line.qty_received.toFixed(3)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

       {activeTab === 'issue' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>MIN Number</th>
                <th>Issue Date</th>
                <th>Work Location / Activity</th>
                <th>Issued By</th>
                <th style={{ textAlign: 'right' }}>Items Count</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No Material Issue Notes recorded yet.
                  </td>
                </tr>
              ) : (
                issues.map((i) => {
                  const issueLines = db.getIssueLines(i.id);
                  const activeIssueLines = issueLines.filter(line => line.qty_issued > 0);
                  const isExpanded = expandedIssueId === i.id;
                  
                  return (
                    <React.Fragment key={i.id}>
                      <tr 
                        onClick={() => setExpandedIssueId(isExpanded ? null : i.id)}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#f8fafc' : 'transparent',
                          transition: 'background-color 0.2s',
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)'
                        }}
                        onMouseEnter={e => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = '#f1f5f9';
                        }}
                        onMouseLeave={e => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ fontWeight: '600' }}>
                          <span style={{ marginRight: '0.5rem', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>▶</span>
                          {i.issue_number}
                        </td>
                        <td>{i.issue_date}</td>
                        <td>{i.issued_to_location}</td>
                        <td>{i.issued_by}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--secondary)' }}>
                          {activeIssueLines.length} items (Click to {isExpanded ? 'Hide' : 'View'})
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {canEditInventory && (
                            <button
                              onClick={() => handleDeleteIssue(i.id, i.issue_number)}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', color: '#ef4444', borderColor: '#fee2e2' }}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 1rem 0.75rem 2rem', backgroundColor: '#f8fafc' }}>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', backgroundColor: 'white' }}>
                              {activeIssueLines.length === 0 ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  No items issued (all values 0) on this note.
                                </div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                      <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Issued Item Name / Description</th>
                                      <th style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-muted)', width: '150px', fontWeight: '600' }}>Quantity Issued</th>
                                      <th style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-muted)', width: '150px', fontWeight: '600' }}>Wastage Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeIssueLines.map((line) => {
                                      const boqItem = boqWorkflow.find(b => b.id === line.boq_item_id) || db.getBOQWorkflowSummary(activeProjectId || '').find(b => b.id === line.boq_item_id);
                                      return (
                                        <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '0.5rem 1rem', color: 'var(--text-main)', fontWeight: '500' }}>
                                            {boqItem ? boqItem.description : 'BOQ Costing Reference Item'}
                                          </td>
                                          <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                                            {line.qty_issued.toFixed(3)}
                                          </td>
                                          <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {line.qty_wastage.toFixed(3)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* GRN Record Modal */}
      {showGRNModal && (
        <div className="overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Record Site Goods Receipt Note (GRN)</h2>
              <button className="close-btn" onClick={() => setShowGRNModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleGRNSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">GRN Number</label>
                  <input
                    type="text"
                    value={grnHeader.grn_number}
                    onChange={(e) => setGrnHeader(prev => ({ ...prev, grn_number: e.target.value }))}
                    className="form-control"
                    required
                  />
                </div>
                
                {/* Supplier Search and Select Bar */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Supplier / Partner</label>
                  <div
                    onClick={() => setShowGrnSupplierDropdown(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.6rem 0.9rem',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      color: grnSupplierId ? 'var(--text-main)' : 'var(--text-muted)'
                    }}
                  >
                    <span>
                      {(() => {
                        const selected = suppliers.find(s => s.id === grnSupplierId);
                        return selected ? `${selected.name} (${selected.type})` : 'Select Supplier';
                      })()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{showGrnSupplierDropdown ? '▲' : '▼'}</span>
                  </div>

                  {showGrnSupplierDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 100,
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="🔍 Search supplier..."
                        value={grnSupplierSearchQuery}
                        onChange={e => setGrnSupplierSearchQuery(e.target.value)}
                        className="form-control"
                        autoFocus
                        style={{
                          marginBottom: '0.5rem',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.85rem'
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {suppliers
                          .filter(s => 
                            s.name.toLowerCase().includes(grnSupplierSearchQuery.toLowerCase())
                          )
                          .map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setGrnSupplierId(s.id);
                                setShowGrnSupplierDropdown(false);
                                setGrnSupplierSearchQuery('');
                              }}
                              style={{
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: grnSupplierId === s.id ? 'var(--primary-light)' : 'transparent',
                                fontSize: '0.82rem',
                                color: 'var(--text-main)',
                                borderBottom: '1px solid #f1f5f9'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = grnSupplierId === s.id ? 'var(--primary-light)' : 'transparent'}
                            >
                              <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({s.type})</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-grid">
                {/* PO Reference Search and Select based on supplier choice */}
                <div className="form-group">
                  <label className="form-label">Link Purchase Order Reference</label>
                  <select
                    value={selectedPOId}
                    onChange={(e) => setSelectedPOId(e.target.value)}
                    className="form-control"
                    disabled={!grnSupplierId}
                    required
                  >
                    <option value="">{grnSupplierId ? 'Select PO Reference' : 'Please choose supplier first'}</option>
                    {pos
                      .filter(po => po.supplier_id === grnSupplierId)
                      .map(po => {
                        const poLinesList = db.getPOLines(po.id).map(pl => pl.description).join(', ');
                        return (
                          <option key={po.id} value={po.id}>
                            {po.po_number} — [{poLinesList.substring(0, 50)}{poLinesList.length > 50 ? '...' : ''}]
                          </option>
                        );
                      })
                    }
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Received By (Site Engineer/Storekeeper)</label>
                  <input
                    type="text"
                    value={grnHeader.received_by}
                    onChange={(e) => setGrnHeader(prev => ({ ...prev, received_by: e.target.value }))}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Received Date</label>
                  <input
                    type="date"
                    value={grnHeader.received_date}
                    onChange={(e) => setGrnHeader(prev => ({ ...prev, received_date: e.target.value }))}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Supplier Delivery Note No.</label>
                  <input
                    type="text"
                    value={grnHeader.delivery_note_number}
                    onChange={(e) => setGrnHeader(prev => ({ ...prev, delivery_note_number: e.target.value }))}
                    placeholder="Enter delivery note number"
                    className="form-control"
                  />
                </div>
              </div>

              {poLines.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>PO Line Details & Balances</h4>
                  <table className="table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th>PO Line Description</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>PO Ordered Qty</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Already Received</th>
                        <th style={{ textAlign: 'right', width: '120px', fontWeight: 'bold' }}>Balance Remaining</th>
                        <th style={{ textAlign: 'right', width: '140px' }}>Qty Received Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poLines.map((line) => {
                        const allGrns = db.getGRNs(activeProjectId || '');
                        let previouslyReceived = 0;
                        allGrns.forEach(g => {
                          const gLines = db.getGRNLines(g.id);
                          const matchingLine = gLines.find(gl => gl.po_line_id === line.id);
                          if (matchingLine) {
                            previouslyReceived += matchingLine.qty_received;
                          }
                        });
                        const balanceQty = Math.max(0, line.qty - previouslyReceived);
                        return (
                          <tr key={line.id}>
                            <td style={{ fontWeight: '500' }}>{line.description}</td>
                            <td style={{ textAlign: 'right' }}>{line.qty.toFixed(3)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{previouslyReceived.toFixed(3)}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: balanceQty > 0 ? 'var(--primary)' : 'var(--success)' }}>
                              {balanceQty.toFixed(3)}
                            </td>
                            <td>
                              <input
                                type="number"
                                value={grnQuantities[line.id] || 0}
                                onChange={(e) => handleGRNQtyChange(line.id, e.target.value)}
                                className="form-control"
                                step="0.001"
                                min="0"
                                max={balanceQty}
                                disabled={balanceQty <= 0}
                                placeholder="0.000"
                                required
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowGRNModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!selectedPOId}>
                  {editingGrnId ? 'Update GRN' : 'Save GRN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Issue Modal */}
      {showIssueModal && (
        <div className="overlay">
          <div className="modal-content modal-lg" style={{ maxHeight: '85vh', padding: '2rem' }}>
            <div className="modal-header">
              <h2 className="modal-title">Record Material Issue Note (MIN)</h2>
              <button className="close-btn" onClick={() => setShowIssueModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleIssueSubmit}>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                <div className="form-group" style={{ flex: 'unset', width: '200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>MIN Issue Number</label>
                  <input
                    type="text"
                    value={issueHeader.issue_number}
                    onChange={(e) => setIssueHeader(prev => ({ ...prev, issue_number: e.target.value }))}
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 'unset', width: '280px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Work Location / Task</label>
                  <input
                    type="text"
                    value={issueHeader.issued_to_location}
                    onChange={(e) => setIssueHeader(prev => ({ ...prev, issued_to_location: e.target.value }))}
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    placeholder="e.g. Zone B piping"
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 'unset', width: '200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Issued By</label>
                  <input
                    type="text"
                    value={issueHeader.issued_by}
                    onChange={(e) => setIssueHeader(prev => ({ ...prev, issued_by: e.target.value }))}
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 'unset', width: '180px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Issue Date</label>
                  <input
                    type="date"
                    value={issueHeader.issue_date}
                    onChange={(e) => setIssueHeader(prev => ({ ...prev, issue_date: e.target.value }))}
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700' }}>Line Items</h4>
                <button type="button" onClick={addIssueLine} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  + Add Item
                </button>
              </div>

              <div style={{ overflow: 'visible', maxHeight: '550px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                <table className="table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60%' }}>Material Item (BOQ)</th>
                      <th style={{ width: '25%' }}>Issued Qty</th>
                      <th style={{ width: '25%' }}>Wastage Qty</th>
                      <th style={{ width: '10%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueLines.map((line, idx) => {
                      const selectedItem = boqWorkflow.find(b => b.id === line.boq_item_id);
                      const currentStock = selectedItem ? selectedItem.stock_balance : 0;
                      const searchQuery = issueSearchQueries[idx] || '';
                      
                      // Filter options: Only show items that have actual stock_balance > 0
                      const availableStockItems = boqWorkflow.filter(b => b.stock_balance > 0);
                      const filteredOptions = availableStockItems.filter(b =>
                        b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.item_code.toLowerCase().includes(searchQuery.toLowerCase())
                      );

                      return (
                        <tr key={idx}>
                          <td style={{ position: 'relative', overflow: 'visible' }}>
                            {/* Search and Select Custom Bar */}
                            <div 
                              onClick={() => setActiveDropdownIndex(activeDropdownIndex === idx ? null : idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'white',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.45rem 0.75rem',
                                cursor: 'pointer',
                                justifyContent: 'space-between',
                                fontSize: '0.82rem',
                                color: selectedItem ? 'var(--text-main)' : 'var(--text-muted)',
                                fontWeight: selectedItem ? '600' : 'normal'
                              }}
                            >
                              <span>
                                {selectedItem 
                                  ? `${selectedItem.item_code} - ${selectedItem.description} (Stock: ${selectedItem.stock_balance.toFixed(3)} ${selectedItem.unit})`
                                  : 'Select Material (Stock Available)'}
                              </span>
                              <span>{activeDropdownIndex === idx ? '▲' : '▼'}</span>
                            </div>

                            {activeDropdownIndex === idx && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                width: '550px',
                                background: 'white',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                boxShadow: 'var(--shadow-lg)',
                                zIndex: 120,
                                marginTop: '0.15rem',
                                padding: '0.5rem',
                                maxHeight: '350px',
                                overflowY: 'auto'
                              }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  placeholder="🔍 Search description or code..."
                                  value={searchQuery}
                                  onChange={e => setIssueSearchQueries(prev => ({ ...prev, [idx]: e.target.value }))}
                                  className="form-control"
                                  autoFocus
                                  style={{
                                    marginBottom: '0.4rem',
                                    padding: '0.3rem 0.5rem',
                                    fontSize: '0.78rem',
                                    height: 'auto'
                                  }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  {filteredOptions.length === 0 ? (
                                    <div style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                      No items with stock match query
                                    </div>
                                  ) : (
                                    filteredOptions.map(b => (
                                      <div
                                        key={b.id}
                                        onClick={() => {
                                          handleIssueLineChange(idx, 'boq_item_id', b.id);
                                          setActiveDropdownIndex(null);
                                          setIssueSearchQueries(prev => ({ ...prev, [idx]: '' }));
                                        }}
                                        style={{
                                          padding: '0.4rem 0.6rem',
                                          cursor: 'pointer',
                                          borderRadius: 'var(--radius-xs)',
                                          backgroundColor: line.boq_item_id === b.id ? 'var(--primary-light)' : 'transparent',
                                          fontSize: '0.78rem',
                                          color: 'var(--text-main)',
                                          borderBottom: '1px solid #f8fafc'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = line.boq_item_id === b.id ? 'var(--primary-light)' : 'transparent'}
                                      >
                                        <strong>{b.item_code}</strong> — {b.description} 
                                        <div style={{ fontSize: '0.7rem', color: 'var(--secondary)', fontWeight: '700', marginTop: '1px' }}>
                                          Available Stock: {b.stock_balance.toFixed(3)} {b.unit}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={line.qty_issued}
                              onChange={(e) => handleIssueLineChange(idx, 'qty_issued', e.target.value)}
                              className="form-control"
                              step="0.001"
                              min="0"
                              max={currentStock}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={line.qty_wastage}
                              onChange={(e) => handleIssueLineChange(idx, 'qty_wastage', e.target.value)}
                              className="form-control"
                              step="0.001"
                              min="0"
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeIssueLine(idx)}
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              disabled={issueLines.length <= 1}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowIssueModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Issue Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Professional GRN PDF Report Preview Sub-window ── */}
      {printGRN && (() => {
        const po = db.getPOs().find(p => p.id === printGRN.po_id);
        const supplier = po ? db.getSuppliers().find(s => s.id === po.supplier_id) : null;
        const project = db.getProjects().find(p => p.id === printGRN.project_id);
        const lines = db.getGRNLines(printGRN.id).filter(l => l.qty_received > 0);

        return (
          <div className="overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1200 }} onClick={() => setPrintGRN(null)}>
            <div 
              className="modal-content" 
              onClick={e => e.stopPropagation()} 
              style={{ maxWidth: '850px', width: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', backgroundColor: '#fcfdfd' }}
            >
              {/* Modal control header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Goods Receipt Note Report</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => window.print()} 
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    🖨️ Print / Save PDF
                  </button>
                  <button 
                    onClick={() => setPrintGRN(null)} 
                    className="btn btn-outline"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              {/* Printable PDF Content Wrapper */}
              <div id="grn-print-report" style={{ flex: 1, overflowY: 'auto', padding: '3rem', backgroundColor: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                
                 {/* Header Letterhead */}
                 {(() => {
                   const company = db.getCompanyDetails();
                   return (
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--primary)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                       <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                         {company.logo && (
                           <img 
                             src={company.logo} 
                             alt="Logo" 
                             style={{ maxHeight: '75px', maxWidth: '200px', borderRadius: '4px', objectFit: 'contain' }} 
                           />
                         )}
                         <div>
                           <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>{company.name}</h1>
                           <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{company.address}</p>
                           <p style={{ margin: '0.25rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}><strong>VAT No:</strong> {company.vat_number} | <strong>CR No:</strong> {company.cr_number}</p>
                         </div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                           GOODS RECEIPT NOTE
                         </div>
                         <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}><strong>GRN No:</strong> {printGRN.grn_number}</p>
                         <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}><strong>Date:</strong> {printGRN.received_date}</p>
                       </div>
                     </div>
                   );
                 })()}

                {/* Metadata details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafbfd' }}>
                    <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Project Information</h4>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Project:</strong> {project?.name || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Client:</strong> {project?.client || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Site Location:</strong> {project?.site_location || 'N/A'}</p>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafbfd' }}>
                    <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>PO & Supplier Reference</h4>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Supplier Name:</strong> {supplier?.name || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>PO Number:</strong> {po?.po_number || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>CR/VAT Registration:</strong> {supplier?.vat_number || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Delivery Note No:</strong> {printGRN.delivery_note_number || 'N/A'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Received Items Summary</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '3rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b', width: '80px' }}>S.No</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>Item Description</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#1e293b', width: '180px' }}>Quantity Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const poLinesList = db.getPOLines();
                      const poLine = poLinesList.find((pl: any) => pl.id === line.po_line_id);
                      let displayName = poLine ? poLine.description : 'Linked PO Item';
                      return (
                        <tr key={line.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{index + 1}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>{displayName}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--secondary)' }}>
                            {line.qty_received.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Sign-off signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', marginTop: '4rem', paddingTop: '2rem', borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '60px' }}></div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '200px', margin: '0 auto', marginBottom: '0.25rem' }}></div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700' }}>Prepared By (Received By)</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{printGRN.received_by}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '60px' }}></div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '200px', margin: '0 auto', marginBottom: '0.25rem' }}></div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700' }}>Approved By (Site Manager)</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signature & Stamp</p>
                  </div>
                </div>

                {/* Print media specific styles */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #grn-print-report, #grn-print-report * {
                      visibility: visible;
                    }
                    #grn-print-report {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      padding: 0;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
