'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { db, PurchaseOrder, Supplier, BOQItem, PurchaseOrderLine } from '@/lib/db';
import { zohoClient } from '@/lib/zoho';

const DEFAULT_MATERIAL_TERMS = `1. Delivery of materials must align with the approved civil technical specifications and submittals.
2. Delivery notes and invoices must clearly reference this document ID.
3. Payment will be released within 30 days of receiving a verified progress invoice at site.`;

const DEFAULT_SUBCONTRACT_TERMS = `1. Delivery of materials must align with the approved civil technical specifications and submittals.
2. Delivery notes and invoices must clearly reference this document ID.
3. Retention amount will be held back until satisfactory completion of testing/commissioning and handover of works.
4. Payment will be released within 30 days of receiving a verified progress invoice at site.`;

export default function ProcurementPage() {
  const { activeProject, activeProjectId } = useProject();
  const { canWrite } = useAuth();
  const canEditPO = canWrite('procurement');

  // Zoho Sync indicators
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const handleSyncToZoho = async (id: string) => {
    setSyncingId(id);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      await zohoClient.syncPurchaseOrder(id);
      setSyncSuccess('Purchase Order synced to Zoho Books successfully!');
      setTimeout(() => setSyncSuccess(null), 3000);
      if (activeProjectId) {
        setPos(db.getPOs(activeProjectId));
      }
    } catch (err: any) {
      setSyncError(`Failed to sync: ${err.message}`);
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setSyncingId(null);
    }
  };

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [poStatus, setPoStatus] = useState<PurchaseOrder['status']>('draft');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [poType, setPoType] = useState<'material' | 'subcontract'>('material');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPo, setPrintPo] = useState<PurchaseOrder | null>(null);
  const poTypeStyle = poType === 'subcontract' ? 'Subcontractor' : 'Material Supplier';

  // Search & Select Supplier States
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Quick Search & Multi-select BOQ States
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedQuickBOQs, setSelectedQuickBOQs] = useState<string[]>([]);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);

  // Quick Add Supplier States
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [quickSupplierData, setQuickSupplierData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    cr_number: '',
    vat_number: ''
  });

  const handleQuickSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuickSupplierData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleQuickSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSupplier = db.saveSupplier({
      ...quickSupplierData,
      type: poType === 'subcontract' ? 'Subcontractor' : 'Material Supplier'
    });
    // Refresh suppliers list
    setSuppliers(db.getSuppliers());
    // Select the newly added supplier
    setPoHeader(prev => ({
      ...prev,
      supplier_id: newSupplier.id
    }));
    // Reset quick add form and close modal
    setQuickSupplierData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      cr_number: '',
      vat_number: ''
    });
    setShowQuickAddSupplier(false);
  };

  const [poHeader, setPoHeader] = useState({
    po_number: '',
    supplier_id: '',
    description: '',
    retention_percent: 0,
    terms_and_conditions: ''
  });

  const [poLines, setPoLines] = useState<Array<{
    boq_item_id: string | null;
    is_non_boq?: boolean;
    searchText?: string;
    description: string;
    supplier_description?: string;
    unit?: string;
    qty: number;
    unit_rate: number;
    vat_rate: number;
  }>>(
    [{ boq_item_id: null, is_non_boq: false, searchText: '', description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]
  );

  const getAvailableBalance = (bItem: any) => {
    if (!bItem) return 0;
    let balance = bItem.boq_balance;
    if (editingPoId && poStatus !== 'draft') {
      const existingLines = db.getPOLines(editingPoId);
      const matchedLines = existingLines.filter(l => l.boq_item_id === bItem.id);
      matchedLines.forEach(l => {
        balance += l.qty;
      });
    }
    return balance;
  };

  const getAvailableValueBalance = (bItem: any) => {
    if (!bItem) return 0;
    const totalBudgetValue = bItem.approved_qty * bItem.unit_rate;
    const activePOs = pos.filter(po => po.status !== 'draft');
    const otherPOLines = db.getPOLines().filter(
      (pol: any) => pol.boq_item_id === bItem.id && 
             activePOs.some(po => po.id === pol.po_id) &&
             (editingPoId ? pol.po_id !== editingPoId : true)
    );
    const orderedValue = otherPOLines.reduce((sum: number, pol: any) => sum + (pol.qty * pol.unit_rate), 0);
    return Math.max(0, totalBudgetValue - orderedValue);
  };

  const loadData = () => {
    if (activeProjectId) {
      setPos(db.getPOs(activeProjectId));
      setSuppliers(db.getSuppliers());
      setBoqItems(db.getBOQWorkflowSummary(activeProjectId));
    }
  };

  useEffect(() => {
    setSearchQuery('');
    setShowPrintModal(false);
    setPrintPo(null);
    loadData();
    return db.subscribe(() => {
      loadData();
    });
  }, [activeProjectId, activeProject]);

  const handleCreateClick = () => {
    setEditingPoId(null);
    setPoStatus('draft');

    // Auto generate PO Number
    const nextNum = db.getPOs().length + 1;
    const autoPoNumber = `PO-${activeProject?.name.substring(0, 3).toUpperCase() || 'GEN'}-${2026}-${String(nextNum).padStart(3, '0')}`;

    setPoHeader({
      po_number: autoPoNumber,
      supplier_id: '',
      description: '',
      retention_percent: 0,
      terms_and_conditions: DEFAULT_MATERIAL_TERMS
    });
    setPoLines([{ boq_item_id: null, is_non_boq: false, searchText: '', description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]);
    setPoType('material');
    setSupplierSearchQuery('');
    setShowSupplierDropdown(false);
    setShowModal(true);
  };

  const handleEditClick = (po: PurchaseOrder) => {
    setEditingPoId(po.id);
    setPoStatus(po.status);
    setPoType(po.type);
    setPoHeader({
      po_number: po.po_number,
      supplier_id: po.supplier_id,
      description: po.description,
      retention_percent: po.retention_percent,
      terms_and_conditions: po.terms_and_conditions || (po.type === 'subcontract' ? DEFAULT_SUBCONTRACT_TERMS : DEFAULT_MATERIAL_TERMS)
    });

    const lines = db.getPOLines(po.id).map(l => {
      const boq = db.getBOQWorkflowSummary(activeProjectId || '').find(b => b.id === l.boq_item_id);
      const isNonBOQ = !l.boq_item_id;
      return {
        boq_item_id: l.boq_item_id || null,
        is_non_boq: isNonBOQ,
        searchText: boq ? `${boq.item_code} - ${boq.description}` : '',
        description: l.description,
        supplier_description: l.supplier_description || '',
        unit: l.unit || (boq ? boq.unit : ''),
        qty: l.qty,
        unit_rate: l.unit_rate,
        vat_rate: l.vat_rate
      };
    });
    setPoLines(lines.length > 0 ? lines : [{ boq_item_id: null, is_non_boq: false, searchText: '', description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]);
    setSupplierSearchQuery('');
    setShowSupplierDropdown(false);
    setShowModal(true);
  };

  const handleAddSelectedBOQs = () => {
    const newLines = selectedQuickBOQs.map(id => {
      const boq = boqItems.find(b => b.id === id);
      return {
        boq_item_id: id,
        searchText: boq ? `${boq.item_code} - ${boq.description}` : '',
        description: boq ? boq.description : '',
        supplier_description: '',
        qty: 0,
        unit_rate: 0,
        vat_rate: boq ? boq.vat_rate : 5.0
      };
    });

    setPoLines(prev => {
      const filteredPrev = prev.filter(l => l.boq_item_id !== '' || l.qty > 0 || l.unit_rate > 0);
      return [...filteredPrev, ...newLines];
    });

    setSelectedQuickBOQs([]);
    setQuickSearch('');
    setShowQuickDropdown(false);
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPoHeader(prev => ({
      ...prev,
      [name]: name === 'retention_percent' ? parseFloat(value) || 0 : value
    }));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...poLines];

    if (field === 'boq_item_id') {
      const boq = boqItems.find(b => b.id === value);
      updated[index] = {
        ...updated[index],
        boq_item_id: value,
        searchText: boq ? `${boq.item_code} - ${boq.description}` : '',
        description: boq ? boq.description : '',
        unit: boq ? boq.unit : '',
        unit_rate: 0,
        vat_rate: boq ? boq.vat_rate : 5.0
      };
    } else if (field === 'searchText') {
      updated[index] = {
        ...updated[index],
        searchText: value
      };
      // Check if value matches "code - description" or exactly matches a code
      const code = value.includes(' - ') ? value.split(' - ')[0] : value;
      const selectedBOQ = boqItems.find(b => b.item_code === code || b.description === value);
      if (selectedBOQ) {
        updated[index].boq_item_id = selectedBOQ.id;
        updated[index].description = selectedBOQ.description;
        updated[index].unit = selectedBOQ.unit;
        updated[index].unit_rate = 0;
        updated[index].vat_rate = selectedBOQ.vat_rate;
        updated[index].searchText = `${selectedBOQ.item_code} - ${selectedBOQ.description}`;
      } else {
        // Clear references but keep search text so user can continue typing
        updated[index].boq_item_id = '';
        updated[index].description = '';
        updated[index].unit = '';
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: field === 'qty' || field === 'unit_rate' || field === 'vat_rate' ? parseFloat(value) || 0 : value
      };
    }

    setPoLines(updated);
  };

  const addLine = () => {
    setPoLines(prev => [...prev, { boq_item_id: null, is_non_boq: false, searchText: '', description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]);
  };

  const addNonBOQLine = () => {
    setPoLines(prev => [...prev, { boq_item_id: null, is_non_boq: true, searchText: '', description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]);
  };

  const removeLine = (idx: number) => {
    setPoLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;

    // Validate: non-BOQ items must have a description
    for (const line of poLines) {
      if (line.is_non_boq && !line.description.trim()) {
        alert('Error: Non-BOQ line items must have a description entered.');
        return;
      }
    }

    // Validate cumulative BOQ value limits
    const cumulativeValueMap = new Map<string, number>();
    for (const line of poLines) {
      if (!line.is_non_boq && line.boq_item_id) {
        cumulativeValueMap.set(line.boq_item_id, (cumulativeValueMap.get(line.boq_item_id) || 0) + (line.qty * line.unit_rate));
      }
    }

    for (const [boqItemId, totalValue] of cumulativeValueMap.entries()) {
      const boqItem = boqItems.find(b => b.id === boqItemId);
      if (boqItem) {
        const maxValue = getAvailableValueBalance(boqItem);
        if (totalValue > maxValue) {
          alert(`Error: Cumulative amount for "${boqItem.description}" (OMR ${totalValue.toFixed(3)}) exceeds the remaining authorized budget (OMR ${maxValue.toFixed(3)}).`);
          return;
        }
      }
    }

    db.savePO(
      {
        id: editingPoId || undefined,
        po_number: poHeader.po_number,
        project_id: activeProjectId,
        supplier_id: poHeader.supplier_id,
        description: poHeader.description,
        status: poStatus,
        type: poType,
        retention_percent: poType === 'subcontract' ? poHeader.retention_percent : 0,
        terms_and_conditions: poHeader.terms_and_conditions
      },
      poLines.map(l => ({
        boq_item_id: l.is_non_boq ? null : (l.boq_item_id || null),
        description: l.description,
        supplier_description: l.supplier_description || '',
        unit: l.unit || '',
        qty: l.qty,
        unit_rate: l.unit_rate,
        vat_rate: l.vat_rate
      }))
    );

    // Reset Form
    setPoHeader({
      po_number: '',
      supplier_id: '',
      description: '',
      retention_percent: 0,
      terms_and_conditions: ''
    });
    setPoLines([{ boq_item_id: null, is_non_boq: false, description: '', supplier_description: '', unit: '', qty: 0, unit_rate: 0, vat_rate: 5.0 }]);
    setEditingPoId(null);
    setPoStatus('draft');
    setShowModal(false);
    loadData();
  };

  const issuePO = (id: string) => {
    db.updatePOStatus(id, 'issued');
    loadData();
  };

  const handleDeletePO = (id: string) => {
    try {
      // Check validation first before prompting confirm dialogs
      const grns = db.getGRNs().filter((g: any) => g.po_id === id);
      const grnLines = db.getGRNLines ? db.getGRNLines(id) : []; // wait, getGRNLines requires grnId, so let's check properly

      // Let's get all GRNs
      if (grns.length > 0) {
        alert("This Purchase Order cannot be deleted because items have already been received at the site. Please delete the associated Goods Receipt Notes first.");
        return;
      }

      if (confirm("Are you sure you want to delete this Purchase Order?")) {
        if (confirm("⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting this Purchase Order?")) {
          db.deletePO(id);
          loadData();
        }
      }
    } catch (error: any) {
      alert(error.message || "An error occurred while trying to delete the Purchase Order.");
    }
  };

  const filteredPos = pos.filter(po => {
    const supplier = suppliers.find(s => s.id === po.supplier_id);
    const searchString = searchQuery.toLowerCase().trim();
    if (!searchString) return true;

    return (
      po.po_number.toLowerCase().includes(searchString) ||
      (po.description || '').toLowerCase().includes(searchString) ||
      (supplier?.name || '').toLowerCase().includes(searchString) ||
      po.status.toLowerCase().includes(searchString) ||
      po.type.toLowerCase().includes(searchString)
    );
  });

  if (!activeProject) {
    return <div className="card">Please select a project to manage Procurement.</div>;
  }

  return (
    <div className="procurement-page-root">
      <div className="print-hide">
        <div className="page-header">
          <div className="page-title-group">
            <h1>Purchase Module</h1>
            <p>Create and manage Material Purchase Orders & Work Orders</p>
          </div>
          {canEditPO && (
            <button onClick={handleCreateClick} className="btn btn-primary">
              + Create Purchase Order
            </button>
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

        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <input
            type="text"
            placeholder="🔍 Search PO number, supplier name, status or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
            style={{ width: '380px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          />
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier / Subcontractor</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Taxable Amt (OMR)</th>
                <th style={{ textAlign: 'right' }}>VAT Amt (5%)</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Retention</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th>Zoho Status</th>
                <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {pos.length === 0
                      ? 'No Purchase Orders created for this project.'
                      : 'No matching Purchase Orders found.'}
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const supplier = suppliers.find(s => s.id === po.supplier_id);
                  const lines = db.getPOLines(po.id);
                  const taxable = lines.reduce((sum, l) => sum + (l.qty * l.unit_rate), 0);
                  const vat = lines.reduce((sum, l) => sum + (l.qty * l.unit_rate * (l.vat_rate / 100)), 0);
                  const total = taxable + vat;
                  const retentionVal = po.type === 'subcontract' ? (taxable * (po.retention_percent / 100)) : 0;

                  return (
                    <tr key={po.id}>
                      <td style={{ fontWeight: '600' }}>{po.po_number}</td>
                      <td>
                        <div>{supplier?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CR No: {supplier?.cr_number || 'N/A'}</div>
                      </td>
                      <td>
                        <span className={`badge ${po.type === 'subcontract' ? 'badge-issued' : 'badge-draft'}`}>
                          {po.type === 'subcontract' ? 'Work Order' : 'Purchase Order'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${po.status}`}>
                          {po.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{taxable.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                      <td style={{ textAlign: 'right' }}>{vat.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                      <td style={{ textAlign: 'right', color: po.type === 'subcontract' ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {po.type === 'subcontract' ? `${po.retention_percent}% (${retentionVal.toFixed(3)})` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {total.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                      </td>
                      <td>
                        {po.zoho_po_id ? (
                          <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #137333', fontSize: '0.72rem' }}>
                            Synced
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #c5221f', fontSize: '0.72rem' }}>
                            Not Synced
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                          {canEditPO && (
                            <button
                              onClick={() => handleSyncToZoho(po.id)}
                              disabled={syncingId === po.id}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#6366f1', color: '#6366f1' }}
                            >
                              {syncingId === po.id ? 'Syncing...' : 'Sync Zoho'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPrintPo(po);
                              setShowPrintModal(true);
                            }}
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                          >
                            📄 Print
                          </button>
                          {po.status === 'draft' && canEditPO && (
                            <button onClick={() => issuePO(po.id)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                              Issue
                            </button>
                          )}
                          {po.status !== 'draft' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '700', margin: '0 0.25rem' }}>Active</span>
                          )}
                          {canEditPO && (
                            <button onClick={() => handleEditClick(po)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                              Edit
                            </button>
                          )}
                          {canEditPO && (
                            <button onClick={() => handleDeletePO(po.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                              Delete
                            </button>
                          )}
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

      {showModal && (
        <div className="overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>{editingPoId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '2rem', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
              {/* Left Column: PO Header Details */}
              <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: 'calc(90vh - 8rem)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary-hover)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  PO Information
                </h3>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">PO Number</label>
                  <input
                    type="text"
                    name="po_number"
                    value={poHeader.po_number}
                    onChange={handleHeaderChange}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">PO Type</label>
                  <select
                    className="form-control"
                    value={poType}
                    onChange={(e) => {
                      const newType = e.target.value as 'material' | 'subcontract';
                      setPoType(newType);
                      setPoHeader(prev => {
                        const current = prev.terms_and_conditions || '';
                        if (current === '' || current === DEFAULT_MATERIAL_TERMS || current === DEFAULT_SUBCONTRACT_TERMS) {
                          return {
                            ...prev,
                            terms_and_conditions: newType === 'subcontract' ? DEFAULT_SUBCONTRACT_TERMS : DEFAULT_MATERIAL_TERMS
                          };
                        }
                        return prev;
                      });
                    }}
                  >
                    <option value="material">Purchase Order - Materials</option>
                    <option value="subcontract">Purchase Order - Subcontract</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Supplier / Partner</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupplier(true)}
                      className="btn btn-outline"
                      style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                    >
                      + Quick Add
                    </button>
                  </div>
                  <div style={{ position: 'relative', width: '100%' }}>
                    {/* Search and Select Bar for Supplier */}
                    <div
                      onClick={() => setShowSupplierDropdown(prev => !prev)}
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
                        color: poHeader.supplier_id ? 'var(--text-main)' : 'var(--text-muted)'
                      }}
                    >
                      <span>
                        {(() => {
                          const selected = suppliers.find(s => s.id === poHeader.supplier_id);
                          return selected ? `${selected.name} (${selected.type})` : 'Select Supplier';
                        })()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{showSupplierDropdown ? '▲' : '▼'}</span>
                    </div>

                    {showSupplierDropdown && (
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
                          placeholder="🔍 Search supplier name or details..."
                          value={supplierSearchQuery}
                          onChange={e => setSupplierSearchQuery(e.target.value)}
                          className="form-control"
                          autoFocus
                          style={{
                            marginBottom: '0.5rem',
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.85rem'
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div
                            onClick={() => {
                              setPoHeader(prev => ({ ...prev, supplier_id: '' }));
                              setShowSupplierDropdown(false);
                              setSupplierSearchQuery('');
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: poHeader.supplier_id === '' ? 'var(--bg-main)' : 'transparent',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              color: 'var(--text-muted)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = poHeader.supplier_id === '' ? 'var(--bg-main)' : 'transparent'}
                          >
                            ✕ Clear Selection (None)
                          </div>

                          {suppliers
                            .filter(s => poType === 'subcontract' ? (s.type === 'Subcontractor' || s.type === 'Both') : (s.type === 'Material Supplier' || s.type === 'Both'))
                            .filter(s =>
                              s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
                              (s.contact_person || '').toLowerCase().includes(supplierSearchQuery.toLowerCase())
                            )
                            .map(s => (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setPoHeader(prev => ({ ...prev, supplier_id: s.id }));
                                  setShowSupplierDropdown(false);
                                  setSupplierSearchQuery('');
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: poHeader.supplier_id === s.id ? 'var(--primary-light)' : 'transparent',
                                  fontSize: '0.82rem',
                                  color: 'var(--text-main)',
                                  borderBottom: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = poHeader.supplier_id === s.id ? 'var(--primary-light)' : 'transparent'}
                              >
                                <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({s.contact_person || 'No Contact'})</span>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {poType === 'subcontract' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Retention Percent (%)</label>
                    <input
                      type="number"
                      name="retention_percent"
                      value={poHeader.retention_percent}
                      onChange={handleHeaderChange}
                      className="form-control"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Remarks / Scope Description</label>
                  <textarea
                    name="description"
                    value={poHeader.description}
                    onChange={handleHeaderChange}
                    className="form-control"
                    rows={4}
                    placeholder="Describe scope or remarks..."
                    style={{ resize: 'none' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Terms & Conditions</label>
                  <textarea
                    name="terms_and_conditions"
                    value={poHeader.terms_and_conditions}
                    onChange={handleHeaderChange}
                    className="form-control"
                    rows={4}
                    placeholder="Enter terms and conditions..."
                    style={{ resize: 'none' }}
                  />
                </div>
              </div>

              {/* Right Column: PO Line Items Spreadsheet */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, maxHeight: 'calc(90vh - 8rem)' }}>
                <div>
                  <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>Purchase Line Items</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={addLine} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                        + Add BOQ Line
                      </button>
                      <button type="button" onClick={addNonBOQLine} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                        + Add Non-BOQ Item
                      </button>
                    </div>
                  </div>

                  {/* Quick Add Multiple BOQ Items Bar */}
                  <div style={{
                    marginBottom: '1rem',
                    background: 'var(--card-bg, #ffffff)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
                      ⚡ Quick Add Multiple BOQ Items
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search BOQ items to select multiple..."
                          value={quickSearch}
                          onChange={(e) => {
                            setQuickSearch(e.target.value);
                            setShowQuickDropdown(true);
                          }}
                          onFocus={() => setShowQuickDropdown(true)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                        />
                        {showQuickDropdown && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            zIndex: 50,
                            padding: '0.4rem',
                            marginTop: '2px'
                          }}>
                            {boqItems
                              .filter(b => b.boq_balance > 0)
                              .filter(b => {
                                if (!quickSearch) return true;
                                const term = quickSearch.toLowerCase();
                                return b.item_code.toLowerCase().includes(term) || b.description.toLowerCase().includes(term);
                              })
                              .map(b => {
                                const isChecked = selectedQuickBOQs.includes(b.id);
                                return (
                                  <label key={b.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.5rem',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                    transition: 'background-color 0.15s',
                                    marginBottom: '2px'
                                  }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(99, 102, 241, 0.12)' : '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedQuickBOQs(prev =>
                                          prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                                        );
                                      }}
                                    />
                                    <div style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                                      <strong>{b.item_code}</strong> - {b.description}
                                    </div>
                                  </label>
                                );
                              })
                            }
                            {boqItems.filter(b => b.boq_balance > 0).length === 0 && (
                              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                No available BOQ items.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddSelectedBOQs}
                        disabled={selectedQuickBOQs.length === 0}
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        Add Selected ({selectedQuickBOQs.length})
                      </button>
                      {showQuickDropdown && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setShowQuickDropdown(false);
                            setSelectedQuickBOQs([]);
                          }}
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: '500px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                    <table className="table line-items-table" style={{ fontSize: '0.85rem', width: '100%', minWidth: '1200px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ width: '60px', textAlign: 'center' }}>Type</th>
                          <th style={{ width: '230px' }}>BOQ Item / Description</th>
                          <th>Description</th>
                          <th style={{ width: '320px' }}>Supplier's Description</th>
                          <th style={{ width: '80px' }}>Unit</th>
                          <th style={{ width: '100px' }}>Quantity</th>
                          <th style={{ width: '120px' }}>Rate (OMR)</th>
                          <th style={{ width: '80px' }}>VAT (%)</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Subtotal</th>
                          <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poLines.map((line, idx) => {
                          const lineExcl = line.qty * line.unit_rate;
                          const lineVat = lineExcl * (line.vat_rate / 100);
                          const isNonBOQ = line.is_non_boq === true;
                          return (
                            <tr key={idx} style={{ backgroundColor: isNonBOQ ? 'rgba(245, 158, 11, 0.04)' : 'transparent' }}>
                              {/* Type toggle cell */}
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                <button
                                  type="button"
                                  title={isNonBOQ ? 'Non-BOQ item (click to switch to BOQ)' : 'BOQ-linked item (click to switch to Non-BOQ)'}
                                  onClick={() => {
                                    const updated = [...poLines];
                                    updated[idx] = { ...updated[idx], is_non_boq: !isNonBOQ, boq_item_id: null, searchText: '', description: isNonBOQ ? '' : updated[idx].description };
                                    setPoLines(updated);
                                  }}
                                  style={{
                                    fontSize: '0.62rem',
                                    padding: '0.2rem 0.35rem',
                                    borderRadius: '999px',
                                    border: `1.5px solid ${isNonBOQ ? 'var(--accent)' : 'var(--primary)'}`,
                                    background: isNonBOQ ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)',
                                    color: isNonBOQ ? 'var(--accent)' : 'var(--primary)',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {isNonBOQ ? 'Non-BOQ' : 'BOQ'}
                                </button>
                              </td>
                              {/* BOQ search / Non-BOQ description */}
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                {!isNonBOQ ? (
                                  <div style={{ position: 'relative', width: '210px' }}>
                                    <input
                                      type="text"
                                      list={`boq-options-${idx}`}
                                      className="form-control"
                                      value={line.searchText ?? ''}
                                      onChange={(e) => handleLineChange(idx, 'searchText', e.target.value)}
                                      placeholder="Search BOQ code or name..."
                                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', width: '100%' }}
                                    />
                                    <datalist id={`boq-options-${idx}`}>
                                      {boqItems
                                        .filter(b => b.boq_balance > 0 || b.id === line.boq_item_id)
                                        .map(b => (
                                          <option key={b.id} value={`${b.item_code} - ${b.description}`} />
                                        ))
                                      }
                                    </datalist>
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={line.description}
                                    onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                                    placeholder="Item description (required)..."
                                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', width: '210px', borderColor: !line.description.trim() ? 'var(--danger)' : undefined }}
                                    required={isNonBOQ}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={line.description || ''}
                                  onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                                  placeholder="Description..."
                                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', width: '210px', borderColor: !line.description.trim() ? 'var(--danger)' : undefined }}
                                  required
                                />
                                {!isNonBOQ && (() => {
                                  const bItem = boqItems.find(b => b.id === line.boq_item_id);
                                  if (!bItem) return null;
                                  const priceInfo = db.getLastPurchasePrice(bItem.id, activeProjectId || '');
                                  const lastPriceStr = priceInfo ? `OMR ${priceInfo.price.toFixed(3)}` : 'N/A';
                                  return (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                      <div>Last Purchased Price: <span style={{ fontWeight: '600', color: 'var(--secondary)' }}>{lastPriceStr}</span></div>
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* Supplier's Description Column */}
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <textarea
                                  className="form-control"
                                  value={line.supplier_description || ''}
                                  ref={(el) => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                  onChange={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                    handleLineChange(idx, 'supplier_description', e.target.value);
                                  }}
                                  placeholder="Supplier's description..."
                                  maxLength={20000}
                                  style={{
                                    fontSize: '0.85rem',
                                    padding: '0.4rem 0.6rem',
                                    width: '300px',
                                    minHeight: '38px',
                                    overflowY: 'hidden',
                                    resize: 'none',
                                    display: 'block'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={line.unit || ''}
                                  onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                                  placeholder="Unit"
                                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.4rem', width: '70px' }}
                                />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="number"
                                  value={line.qty}
                                  onChange={(e) => handleLineChange(idx, 'qty', e.target.value)}
                                  className="form-control"
                                  step="0.001"
                                  min="0"
                                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem', width: '90px' }}
                                  required
                                />
                                {(() => {
                                  const bItem = boqItems.find(b => b.id === line.boq_item_id);
                                  if (bItem) {
                                    const totalValue = poLines
                                      .filter(l => l.boq_item_id === bItem.id)
                                      .reduce((sum, l) => sum + (l.qty * l.unit_rate), 0);
                                    const maxValue = getAvailableValueBalance(bItem);
                                    if (totalValue > maxValue) {
                                      return (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--danger)', marginTop: '0.15rem', fontWeight: 'bold' }}>
                                          Exceeds available budget!
                                        </div>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="number"
                                  value={line.unit_rate}
                                  onChange={(e) => handleLineChange(idx, 'unit_rate', e.target.value)}
                                  className="form-control"
                                  step="0.001"
                                  min="0"
                                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem', width: '100px' }}
                                  required
                                />
                                {(() => {
                                  if (!line.boq_item_id || !activeProjectId) return null;
                                  const bItem = boqItems.find(b => b.id === line.boq_item_id);
                                  const priceInfo = db.getLastPurchasePrice(line.boq_item_id, activeProjectId);
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.2rem' }}>
                                      {bItem && (() => {
                                        const totalValue = poLines
                                          .filter(l => l.boq_item_id === bItem.id)
                                          .reduce((sum, l) => sum + (l.qty * l.unit_rate), 0);
                                        const maxValue = getAvailableValueBalance(bItem);
                                        return totalValue > maxValue ? (
                                          <div style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 'bold' }}>
                                            Exceeds budget limit!
                                          </div>
                                        ) : null;
                                      })()}
                                      {priceInfo ? (
                                        priceInfo.isOtherProject ? (
                                          <div style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: '700', lineHeight: '1.2' }} title={`From Project: ${priceInfo.projectName}`}>
                                            Last (Other Proj):<br />OMR {priceInfo.price.toFixed(3)}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '0.68rem', color: 'var(--secondary)', fontWeight: '600' }}>
                                            Last: OMR {priceInfo.price.toFixed(3)}
                                          </div>
                                        )
                                      ) : (
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Last: N/A</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="number"
                                  value={line.vat_rate}
                                  onChange={(e) => handleLineChange(idx, 'vat_rate', e.target.value)}
                                  className="form-control"
                                  step="0.1"
                                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem', width: '65px' }}
                                  required
                                />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', textAlign: 'right', fontSize: '0.85rem' }}>
                                {(lineExcl + lineVat).toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="btn btn-danger"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  disabled={poLines.length <= 1}
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

                  {/* Totals Summary Calculation Card */}
                  {(() => {
                    const formSubtotal = poLines.reduce((sum, line) => sum + (line.qty * line.unit_rate), 0);
                    const formVatAmount = poLines.reduce((sum, line) => sum + (line.qty * line.unit_rate * (line.vat_rate / 100)), 0);
                    const formGrandTotal = formSubtotal + formVatAmount;
                    return (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '1rem',
                        fontSize: '0.88rem'
                      }}>
                        <div style={{
                          minWidth: '300px',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Subtotal (Excl. VAT):</span>
                            <span style={{ fontWeight: '600' }}>OMR {formSubtotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>VAT Amount:</span>
                            <span style={{ fontWeight: '600' }}>OMR {formVatAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                            <span style={{ fontWeight: 'bold' }}>Grand Total (Incl. VAT):</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>OMR {formGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save PO Draft
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {showQuickAddSupplier && (
        <div className="overlay" onClick={() => setShowQuickAddSupplier(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Quick Add {poType === 'subcontract' ? 'Subcontractor' : 'Supplier'}
              </h2>
              <button className="close-btn" onClick={() => setShowQuickAddSupplier(false)}>&times;</button>
            </div>

            <form onSubmit={handleQuickSupplierSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  name="name"
                  value={quickSupplierData.name}
                  onChange={handleQuickSupplierInputChange}
                  className="form-control"
                  required
                  placeholder="e.g. Al-Futtaim Engineering"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input
                  type="text"
                  name="contact_person"
                  value={quickSupplierData.contact_person}
                  onChange={handleQuickSupplierInputChange}
                  className="form-control"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={quickSupplierData.email}
                    onChange={handleQuickSupplierInputChange}
                    className="form-control"
                    placeholder="e.g. supplier@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={quickSupplierData.phone}
                    onChange={handleQuickSupplierInputChange}
                    className="form-control"
                    placeholder="e.g. +968 99228833"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">CR No</label>
                  <input
                    type="text"
                    name="cr_number"
                    value={quickSupplierData.cr_number}
                    onChange={handleQuickSupplierInputChange}
                    className="form-control"
                    placeholder="e.g. 1029384"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">VAT Reg Number</label>
                  <input
                    type="text"
                    name="vat_number"
                    value={quickSupplierData.vat_number}
                    onChange={handleQuickSupplierInputChange}
                    className="form-control"
                    placeholder="e.g. OM1100029348"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowQuickAddSupplier(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE ORDER / SUBCONTRACT AGREEMENT PRINT PREVIEW MODAL */}
      {showPrintModal && printPo && (() => {
        const printSupplier = suppliers.find(s => s.id === printPo.supplier_id);
        const printLines = db.getPOLines(printPo.id);
        const printTaxable = printLines.reduce((sum, l) => sum + (l.qty * l.unit_rate), 0);
        const printVat = printLines.reduce((sum, l) => sum + (l.qty * l.unit_rate * (l.vat_rate / 100)), 0);
        const printTotal = printTaxable + printVat;
        const printRetention = printPo.type === 'subcontract' ? (printTaxable * (printPo.retention_percent / 100)) : 0;
        const netPayable = printTotal - printRetention;

        return (
          <div className="overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
              <style>{`
                .print-page-margin-spacer {
                  display: none;
                }
                @media print {
                  @page {
                    size: A4;
                    margin: 0;
                  }
                  .print-page-margin-spacer {
                    display: block !important;
                    height: 18mm !important;
                  }
                  /* Hide all screen components */
                  .print-hide, 
                  .navbar,
                  header,
                  .app-container > *:not(.procurement-page-root),
                  .procurement-page-root > *:not(.overlay),
                  .overlay > *:not(.modal-content),
                  .modal-content > *:not(.print-po-area) {
                    display: none !important;
                  }
                  html, #__next, .app-container, .procurement-page-root {
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    height: auto !important;
                    max-height: none !important;
                    overflow: visible !important;
                  }
                  body {
                    background: white !important;
                    margin: 0 15mm !important;
                    padding: 0 !important;
                    height: auto !important;
                    max-height: none !important;
                    overflow: visible !important;
                  }
                  .overlay {
                    position: static !important;
                    background: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    display: block !important;
                    height: auto !important;
                    min-height: auto !important;
                  }
                  .modal-content {
                    background: white !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    max-height: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    overflow: visible !important;
                    display: block !important;
                  }
                  .print-po-area {
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100% !important;
                    max-height: none !important;
                    overflow: visible !important;
                    display: block !important;
                    box-sizing: border-box !important;
                  }
                }
              `}</style>

              <div className="modal-header print-hide" style={{ padding: '0 0 0.5rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>
                  📄 {printPo.type === 'subcontract' ? 'Purchase Order - Subcontract' : 'Purchase Order - Materials'} Preview
                </h2>
                <button className="close-btn" onClick={() => {
                  setShowPrintModal(false);
                  setPrintPo(null);
                }}>&times;</button>
              </div>

              {/* Printable Area */}
              <div className="print-po-area" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', fontFamily: 'Arial, sans-serif' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                  <thead>
                    <tr>
                      <td style={{ border: 'none', padding: 0 }}>
                        <div className="print-page-margin-spacer"></div>
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: 0 }}>
                        {/* Letterhead */}
                        {(() => {
                          const company = db.getCompanyDetails();
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.5rem' }}>
                              {company.logo ? (
                                <img
                                  src={company.logo}
                                  alt="Logo"
                                  style={{ maxHeight: '50px', maxWidth: '150px', borderRadius: '4px', objectFit: 'contain' }}
                                />
                              ) : (
                                <div></div>
                              )}
                              <div style={{ textAlign: 'right' }}>
                                <h1 style={{ margin: '0 0 0.15rem 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', letterSpacing: '0.5px' }}>
                                  {company.name}
                                </h1>
                                <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>
                                  {company.address}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                  <strong>VAT No:</strong> {company.vat_number} | <strong>CR No:</strong> {company.cr_number}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Title */}
                        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold', textDecoration: 'underline', color: '#0f172a', letterSpacing: '0.5px' }}>
                            {printPo.type === 'subcontract' ? 'PURCHASE ORDER - SUBCONTRACT' : 'PURCHASE ORDER - MATERIALS'}
                          </h2>
                        </div>

                        {/* Metadata Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.75rem', lineHeight: '1.4' }}>
                          <div style={{ border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', marginBottom: '0.4rem', fontWeight: 'bold', color: '#475569' }}>
                              {printPo.type === 'subcontract' ? 'SUBCONTRACT DETAILS' : 'ORDER DETAILS'}
                            </div>
                            <div><strong>Document Ref:</strong> {printPo.po_number}</div>
                            <div><strong>Date Issued:</strong> {new Date(printPo.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div><strong>Project:</strong> {activeProject.name}</div>
                            <div><strong>Site Location:</strong> {activeProject.site_location || 'Muscat, Oman'}</div>
                          </div>
                          <div style={{ border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem', marginBottom: '0.4rem', fontWeight: 'bold', color: '#475569' }}>
                              {printPo.type === 'subcontract' ? 'SUBCONTRACTOR DETAILS' : 'SUPPLIER DETAILS'}
                            </div>
                            <div><strong>Name:</strong> {printSupplier?.name || 'N/A'}</div>
                            <div><strong>Contact Person:</strong> {printSupplier?.contact_person || 'N/A'}</div>
                            {printSupplier?.email && <div><strong>Email:</strong> {printSupplier.email}</div>}
                            {printSupplier?.phone && <div><strong>Phone:</strong> {printSupplier.phone}</div>}
                            <div><strong>CR No:</strong> {printSupplier?.cr_number || 'N/A'}</div>
                            <div><strong>VAT:</strong> {printSupplier?.vat_number || 'N/A'}</div>
                            {printSupplier?.address && <div><strong>Address:</strong> {printSupplier.address}</div>}
                          </div>
                        </div>

                        {/* Remarks / Scope Description */}
                        {printPo.description && (
                          <div style={{ border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.72rem', color: '#334155' }}>
                            <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '0.2rem' }}>REMARKS / SCOPE DESCRIPTION:</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{printPo.description}</div>
                          </div>
                        )}

                        {/* Items Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', marginBottom: '0.75rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1' }}>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'left', width: '6%' }}>S.No</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'left' }}>Description of Scope / Materials</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'center', width: '10%' }}>Unit</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', width: '10%' }}>Qty</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', width: '15%' }}>Rate (OMR)</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', width: '10%' }}>VAT %</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', width: '15%' }}>Amount (OMR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {printLines.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ border: '1px solid #cbd5e1', padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                  No items added to this document.
                                </td>
                              </tr>
                            ) : (
                              printLines.map((line, idx) => {
                                const lineVal = line.qty * line.unit_rate;
                                return (
                                  <tr key={line.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem' }}>
                                      {line.boq_item_id ? (
                                        <div>{line.supplier_description || ''}</div>
                                      ) : (
                                        <>
                                          <div>{line.description}</div>
                                          {line.supplier_description && (
                                            <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.15rem', fontStyle: 'italic' }}>
                                              Supplier Desc: {line.supplier_description}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                                      {line.unit || boqItems.find(item => item.id === line.boq_item_id)?.unit || 'N/A'}
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right' }}>
                                      {printPo.type === 'subcontract'
                                        ? line.unit_rate.toLocaleString('en-US', { minimumFractionDigits: 3 })
                                        : line.qty}
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right' }}>
                                      {printPo.type === 'subcontract'
                                        ? line.qty.toLocaleString('en-US', { minimumFractionDigits: 3 })
                                        : line.unit_rate.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right' }}>{line.vat_rate}%</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: '500' }}>
                                      {lineVal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                    </td>
                                  </tr>
                                );
                              })
                            )}

                            {/* Cost Summaries */}
                            <tr style={{ borderTop: '2px solid #cbd5e1' }}>
                              <td colSpan={5} style={{ border: 'none', padding: '0.2rem 0.4rem', textAlign: 'right' }}>Taxable Amount (Excl. VAT):</td>
                              <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '0.2rem 0.4rem', textAlign: 'right', fontWeight: 'bold' }}>
                                {printTaxable.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={5} style={{ border: 'none', padding: '0.2rem 0.4rem', textAlign: 'right' }}>VAT Component (5%):</td>
                              <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '0.2rem 0.4rem', textAlign: 'right', fontWeight: 'bold' }}>
                                {printVat.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                            {printPo.type === 'subcontract' && printPo.retention_percent > 0 && (
                              <tr>
                                <td colSpan={5} style={{ border: 'none', padding: '0.2rem 0.4rem', textAlign: 'right', color: 'var(--danger)' }}>
                                  Retention Deducted ({printPo.retention_percent}%):
                                </td>
                                <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '0.2rem 0.4rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--danger)' }}>
                                  -{printRetention.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                </td>
                              </tr>
                            )}
                            <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', borderBottom: '2px double #cbd5e1' }}>
                              <td colSpan={5} style={{ border: 'none', padding: '0.3rem 0.4rem', textAlign: 'right', fontSize: '0.78rem' }}>
                                {printPo.type === 'subcontract' ? 'NET PAYABLE VALUE:' : 'GRAND TOTAL:'}
                              </td>
                              <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '0.3rem 0.4rem', textAlign: 'right', fontSize: '0.82rem', color: '#1e3a8a' }}>
                                OMR {netPayable.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Keep Terms and Sign-offs together to prevent orphan signatures */}
                        <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '0.75rem' }}>
                          {/* Terms and conditions */}
                          <div style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', color: '#475569', lineHeight: '1.3', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '0.2rem' }}>TERMS & CONDITIONS:</div>
                            {(printPo.terms_and_conditions || (printPo.type === 'subcontract' ? DEFAULT_SUBCONTRACT_TERMS : DEFAULT_MATERIAL_TERMS))
                              .split('\n')
                              .map((term, idx) => (
                                <div key={idx} style={{ marginBottom: '0.1rem' }}>{term}</div>
                              ))
                            }
                          </div>

                          {/* Sign-offs */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', paddingTop: '0.5rem' }}>
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem', width: '220px' }}>
                              <span><strong>Authorized Signature:</strong><br />Dimah Al Raedah SPC</span>
                              <div style={{ borderTop: '1px solid #cbd5e1', width: '90%', margin: '0 auto', paddingTop: '0.2rem' }}>Signature & Date</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ border: 'none', padding: 0 }}>
                        <div className="print-page-margin-spacer"></div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Action Footer */}
              <div className="modal-footer print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => {
                  setShowPrintModal(false);
                  setPrintPo(null);
                }}>Close Preview</button>
                <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' }}>
                  🖨️ Print Agreement / Save PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
