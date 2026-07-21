'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { db, BOQItem, ClientBOQItem, ClientClaim, ClientClaimLine } from '@/lib/db';

export default function BOQPage() {
  const { activeProject, activeProjectId } = useProject();
  const { canWrite, currentUser } = useAuth();
  const canEditBOQ = canWrite('boq');

  const [dbProject, setDbProject] = useState<any>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'internal' | 'client_setup' | 'claim_report'>('internal');

  // Internal BOQ States
  const [items, setItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewSection, setIsNewSection] = useState(false);
  const [isNewSubSection, setIsNewSubSection] = useState(false);
  const [autoCode, setAutoCode] = useState(true);

  // CSV Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    item_code: '',
    description: '',
    section: '',
    sub_section: '',
    unit: '',
    planned_qty: 0,
    approved_qty: 0,
    unit_rate: 0,
    vat_rate: 5.0,
    client_boq_item_id: '',
    client_boq_section: '',
    client_boq_sub_section: '',
    is_manpower_cost: false
  });

  const [selectedClientBOQIds, setSelectedClientBOQIds] = useState<string[]>([]);

  // Client BOQ States
  const [clientItems, setClientItems] = useState<ClientBOQItem[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientFormData, setClientFormData] = useState({
    item_code: '',
    description: '',
    value: 0,
    section: '',
    sub_section: '',
    unit: '',
    qty: 0,
    unit_rate: 0
  });

  // Claim Report States
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [historicalClaims, setHistoricalClaims] = useState<ClientClaim[]>([]);
  const [expandedClientBOQ, setExpandedClientBOQ] = useState<{ [id: string]: boolean }>({});
  const [editedClaims, setEditedClaims] = useState<{ [id: string]: number }>({});
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [retentionRate, setRetentionRate] = useState<number>(10);
  const [retentionCap, setRetentionCap] = useState<number>(5);
  const [advanceReceived, setAdvanceReceived] = useState<number>(0);
  const [customPreviousPayments, setCustomPreviousPayments] = useState<string>('');
  const [invoiceClassification, setInvoiceClassification] = useState<'interim' | 'pre_final' | 'final'>('interim');
  const [projectOrderNumber, setProjectOrderNumber] = useState<string>('');
  const [customProjectClientValue, setCustomProjectClientValue] = useState<string>('');
  const [customClientNameAddress, setCustomClientNameAddress] = useState<string>('');
  const [additionItems, setAdditionItems] = useState<{ id: string; name: string; value: number }[]>([]);
  const [deductionItems, setDeductionItems] = useState<{ id: string; name: string; value: number }[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [id: string]: boolean }>({});
  const [selectedClientItems, setSelectedClientItems] = useState<{ [id: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<{ [sec: string]: boolean }>({});
  const [collapsedSubSections, setCollapsedSubSections] = useState<{ [key: string]: boolean }>({});
  const [collapsedClientSections, setCollapsedClientSections] = useState<{ [sec: string]: boolean }>({});
  const [collapsedClientSubSections, setCollapsedClientSubSections] = useState<{ [key: string]: boolean }>({});
  const [activeLinkedInfoId, setActiveLinkedInfoId] = useState<string | null>(null);

  // Client BOQ CSV Import States
  const [showClientImportModal, setShowClientImportModal] = useState(false);
  const [clientImportPreview, setClientImportPreview] = useState<any[]>([]);
  const [clientImportErrors, setClientImportErrors] = useState<string[]>([]);

  // Bulk Link Modal State
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);
  // Map of itemId → chosen clientBOQItemId (empty string = unlink)
  const [bulkLinkMap, setBulkLinkMap] = useState<{ [id: string]: string }>({});
  const [bulkLinkGlobal, setBulkLinkGlobal] = useState<string>('__keep__');
  const [bulkLinkSearchQuery, setBulkLinkSearchQuery] = useState<string>('');
  const [showBulkLinkDropdown, setShowBulkLinkDropdown] = useState<boolean>(false);
  const [mappingSearchText, setMappingSearchText] = useState<string>('');
  const [showMappingDropdown, setShowMappingDropdown] = useState<boolean>(false);

  const loadItems = () => {
    if (activeProjectId) {
      const summary = db.getBOQWorkflowSummary(activeProjectId);
      setItems(summary);

      const cItems = db.getClientBOQItems(activeProjectId);
      setClientItems(cItems);

      const claimsList = db.getClientClaims(activeProjectId);
      setHistoricalClaims(claimsList);

      const proj = db.getProjects().find(p => p.id === activeProjectId);
      setDbProject(proj || null);
    }
  };

  const getMappingLabel = () => {
    if (formData.client_boq_sub_section) {
      return `Sub-section: ${formData.client_boq_section} > ${formData.client_boq_sub_section}`;
    }
    if (formData.client_boq_section) {
      return `Header: ${formData.client_boq_section}`;
    }
    if (formData.client_boq_item_id) {
      const matched = clientItems.find(c => c.id === formData.client_boq_item_id);
      return matched ? `Item: ${matched.item_code} - ${matched.description}` : 'Unknown Item';
    }
    return '-- Do Not Map / Unmapped --';
  };

  useEffect(() => {
    setEditedClaims({});
    setSelectedItems({});
    setSelectedClientItems({});
    setActiveLinkedInfoId(null);
    setSearchQuery('');
    loadItems();
    return db.subscribe(() => {
      loadItems();
    });
  }, [activeProjectId]);

  useEffect(() => {
    setSelectedItems({});
    setSelectedClientItems({});
    setActiveLinkedInfoId(null);
    setSearchQuery('');
    setBulkLinkSearchQuery('');
    setShowBulkLinkDropdown(false);
  }, [activeTab]);

  // --- Internal BOQ Handlers ---
  const generateStandardCode = (sectionName: string) => {
    const sec = sectionName || 'General Works';
    const uniqueSections = Array.from(new Set(items.map(item => item.section || 'General Works')));

    let secIndex = uniqueSections.indexOf(sec) + 1;
    if (secIndex === 0) {
      secIndex = uniqueSections.length + 1;
    }

    const itemCount = items.filter(item => (item.section || 'General Works') === sec).length;
    return `BOQ-${secIndex}.${itemCount + 1}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: ['planned_qty', 'approved_qty', 'unit_rate', 'vat_rate'].includes(name)
          ? parseFloat(value) || 0
          : value
      };

      if (name === 'section' && autoCode) {
        updated.item_code = generateStandardCode(value);
      }

      return updated;
    });
  };

  const handleDescriptionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      description: value
    }));

    if (value.trim().length > 0) {
      const allSugs = db.getHistoricalBOQSuggestions();
      const filtered = allSugs.filter(s =>
        s.description.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (sug: any) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        description: sug.description,
        item_code: sug.item_code,
        unit: sug.unit,
        unit_rate: sug.unit_rate,
        section: sug.section || ''
      };
      if (autoCode) {
        updated.item_code = generateStandardCode(sug.section || '');
      }
      return updated;
    });
    setShowSuggestions(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setIsNewSection(false);
    setIsNewSubSection(false);
    setAutoCode(true);
    setSuggestions([]);
    setShowSuggestions(false);
    setMappingSearchText('');
    setShowMappingDropdown(false);
    setFormData({
      item_code: '',
      description: '',
      section: '',
      sub_section: '',
      unit: '',
      planned_qty: 0,
      approved_qty: 0,
      unit_rate: 0,
      vat_rate: 5.0,
      client_boq_item_id: '',
      client_boq_section: '',
      client_boq_sub_section: '',
      is_manpower_cost: false
    });
    setSelectedClientBOQIds([]);
  };

  const handleCreateClick = () => {
    const defaultSection = items.length > 0 && items[0].section ? items[0].section : 'General Works';
    const nextCode = generateStandardCode(defaultSection);
    setFormData({
      item_code: nextCode,
      description: '',
      section: defaultSection,
      sub_section: 'General',
      unit: '',
      planned_qty: 0,
      approved_qty: 0,
      unit_rate: 0,
      vat_rate: 5.0,
      client_boq_item_id: '',
      client_boq_section: '',
      client_boq_sub_section: '',
      is_manpower_cost: false
    });
    setSelectedClientBOQIds([]);
    setAutoCode(true);
    setEditingId(null);
    setIsNewSection(false);
    setIsNewSubSection(false);
    setMappingSearchText('');
    setShowMappingDropdown(false);
    setShowModal(true);
  };

  const handleAutoCodeToggle = (checked: boolean) => {
    setAutoCode(checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        item_code: generateStandardCode(prev.section)
      }));
    }
  };

  const handleMoveSection = (sectionName: string, direction: 'up' | 'down') => {
    const uniqueSections = Array.from(new Set(items.map(item => item.section || 'General Works')));
    const index = uniqueSections.indexOf(sectionName);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = uniqueSections[index];
      uniqueSections[index] = uniqueSections[index - 1];
      uniqueSections[index - 1] = temp;
    } else if (direction === 'down' && index < uniqueSections.length - 1) {
      const temp = uniqueSections[index];
      uniqueSections[index] = uniqueSections[index + 1];
      uniqueSections[index + 1] = temp;
    } else {
      return; // Cannot move
    }

    const orderedItems: any[] = [];
    uniqueSections.forEach(sec => {
      const secItems = items.filter(item => (item.section || 'General Works') === sec);
      orderedItems.push(...secItems);
    });

    const updates = orderedItems.map((item, idx) => ({
      id: item.id,
      sort_order: idx * 10
    }));

    db.saveBOQItemsOrder(updates);
  };

  const handleMoveSubSection = (sectionName: string, subSectionName: string, direction: 'up' | 'down') => {
    const secItems = items.filter(item => (item.section || 'General Works') === sectionName);
    const uniqueSubSections = Array.from(new Set(secItems.map(item => item.sub_section || 'General')));
    const index = uniqueSubSections.indexOf(subSectionName);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = uniqueSubSections[index];
      uniqueSubSections[index] = uniqueSubSections[index - 1];
      uniqueSubSections[index - 1] = temp;
    } else if (direction === 'down' && index < uniqueSubSections.length - 1) {
      const temp = uniqueSubSections[index];
      uniqueSubSections[index] = uniqueSubSections[index + 1];
      uniqueSubSections[index + 1] = temp;
    } else {
      return; // Cannot move
    }

    const newItemsOrder = [...items];
    const sectionIndexes = items
      .map((item, idx) => (item.section || 'General Works') === sectionName ? idx : -1)
      .filter(idx => idx !== -1);

    if (sectionIndexes.length === 0) return;
    const startIdx = sectionIndexes[0];

    const orderedSecItems: any[] = [];
    uniqueSubSections.forEach(subSec => {
      const subSecItems = secItems.filter(item => (item.sub_section || 'General') === subSec);
      orderedSecItems.push(...subSecItems);
    });

    newItemsOrder.splice(startIdx, sectionIndexes.length, ...orderedSecItems);

    const updates = newItemsOrder.map((item, idx) => ({
      id: item.id,
      sort_order: idx * 10
    }));

    db.saveBOQItemsOrder(updates);
  };

  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    const currentItem = items[itemIndex];
    const sectionName = currentItem.section || 'General Works';
    const subSectionName = currentItem.sub_section || 'General';

    const subSecItems = items.filter(
      item => (item.section || 'General Works') === sectionName && (item.sub_section || 'General') === subSectionName
    );
    const subSecIndex = subSecItems.findIndex(item => item.id === itemId);

    if (direction === 'up' && subSecIndex > 0) {
      const prevItem = subSecItems[subSecIndex - 1];
      const prevGlobalIndex = items.findIndex(item => item.id === prevItem.id);

      const newItemsOrder = [...items];
      newItemsOrder[itemIndex] = prevItem;
      newItemsOrder[prevGlobalIndex] = currentItem;

      const updates = newItemsOrder.map((item, idx) => ({
        id: item.id,
        sort_order: idx * 10
      }));
      db.saveBOQItemsOrder(updates);
    } else if (direction === 'down' && subSecIndex < subSecItems.length - 1) {
      const nextItem = subSecItems[subSecIndex + 1];
      const nextGlobalIndex = items.findIndex(item => item.id === nextItem.id);

      const newItemsOrder = [...items];
      newItemsOrder[itemIndex] = nextItem;
      newItemsOrder[nextGlobalIndex] = currentItem;

      const updates = newItemsOrder.map((item, idx) => ({
        id: item.id,
        sort_order: idx * 10
      }));
      db.saveBOQItemsOrder(updates);
    }
  };

  const handleMoveClientSection = (sectionName: string, direction: 'up' | 'down') => {
    const uniqueSections = Array.from(new Set(clientItems.map(item => item.section || 'General')));
    const index = uniqueSections.indexOf(sectionName);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = uniqueSections[index];
      uniqueSections[index] = uniqueSections[index - 1];
      uniqueSections[index - 1] = temp;
    } else if (direction === 'down' && index < uniqueSections.length - 1) {
      const temp = uniqueSections[index];
      uniqueSections[index] = uniqueSections[index + 1];
      uniqueSections[index + 1] = temp;
    } else {
      return; // Cannot move
    }

    const orderedItems: any[] = [];
    uniqueSections.forEach(sec => {
      const secItems = clientItems.filter(item => (item.section || 'General') === sec);
      orderedItems.push(...secItems);
    });

    const updates = orderedItems.map((item, idx) => ({
      id: item.id,
      sort_order: idx * 10
    }));

    db.saveClientBOQItemsOrder(updates);
  };

  const handleMoveClientSubSection = (sectionName: string, subSectionName: string, direction: 'up' | 'down') => {
    const secItems = clientItems.filter(item => (item.section || 'General') === sectionName);
    const uniqueSubSections = Array.from(new Set(secItems.map(item => item.sub_section || 'General')));
    const index = uniqueSubSections.indexOf(subSectionName);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = uniqueSubSections[index];
      uniqueSubSections[index] = uniqueSubSections[index - 1];
      uniqueSubSections[index - 1] = temp;
    } else if (direction === 'down' && index < uniqueSubSections.length - 1) {
      const temp = uniqueSubSections[index];
      uniqueSubSections[index] = uniqueSubSections[index + 1];
      uniqueSubSections[index + 1] = temp;
    } else {
      return; // Cannot move
    }

    const newItemsOrder = [...clientItems];
    const sectionIndexes = clientItems
      .map((item, idx) => (item.section || 'General') === sectionName ? idx : -1)
      .filter(idx => idx !== -1);

    if (sectionIndexes.length === 0) return;
    const startIdx = sectionIndexes[0];

    const orderedSecItems: any[] = [];
    uniqueSubSections.forEach(subSec => {
      const subSecItems = secItems.filter(item => (item.sub_section || 'General') === subSec);
      orderedSecItems.push(...subSecItems);
    });

    newItemsOrder.splice(startIdx, sectionIndexes.length, ...orderedSecItems);

    const updates = newItemsOrder.map((item, idx) => ({
      id: item.id,
      sort_order: idx * 10
    }));

    db.saveClientBOQItemsOrder(updates);
  };

  const handleMoveClientItem = (itemId: string, direction: 'up' | 'down') => {
    const itemIndex = clientItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    const currentItem = clientItems[itemIndex];
    const sectionName = currentItem.section || 'General';
    const subSectionName = currentItem.sub_section || 'General';

    const subSecItems = clientItems.filter(
      item => (item.section || 'General') === sectionName && (item.sub_section || 'General') === subSectionName
    );
    const subSecIndex = subSecItems.findIndex(item => item.id === itemId);

    if (direction === 'up' && subSecIndex > 0) {
      const prevItem = subSecItems[subSecIndex - 1];
      const prevGlobalIndex = clientItems.findIndex(item => item.id === prevItem.id);

      const newItemsOrder = [...clientItems];
      newItemsOrder[itemIndex] = prevItem;
      newItemsOrder[prevGlobalIndex] = currentItem;

      const updates = newItemsOrder.map((item, idx) => ({
        id: item.id,
        sort_order: idx * 10
      }));
      db.saveClientBOQItemsOrder(updates);
    } else if (direction === 'down' && subSecIndex < subSecItems.length - 1) {
      const nextItem = subSecItems[subSecIndex + 1];
      const nextGlobalIndex = clientItems.findIndex(item => item.id === nextItem.id);

      const newItemsOrder = [...clientItems];
      newItemsOrder[itemIndex] = nextItem;
      newItemsOrder[nextGlobalIndex] = currentItem;

      const updates = newItemsOrder.map((item, idx) => ({
        id: item.id,
        sort_order: idx * 10
      }));
      db.saveClientBOQItemsOrder(updates);
    }
  };

  const handleEditClick = (item: any) => {
    setFormData({
      item_code: item.item_code,
      description: item.description,
      section: item.section || 'General Works',
      sub_section: item.sub_section || 'General',
      unit: item.unit,
      planned_qty: item.planned_qty,
      approved_qty: item.approved_qty,
      unit_rate: item.unit_rate,
      vat_rate: item.vat_rate,
      client_boq_item_id: item.client_boq_item_id || '',
      client_boq_section: item.client_boq_section || '',
      client_boq_sub_section: item.client_boq_sub_section || '',
      is_manpower_cost: !!item.is_manpower_cost
    });
    const links = db.getManpowerLinks(item.id);
    setSelectedClientBOQIds(links.map(l => l.client_boq_item_id));
    setEditingId(item.id);
    setAutoCode(false);
    setIsNewSection(false);
    setIsNewSubSection(false);
    let initialText = '';
    if (item.client_boq_sub_section) {
      initialText = `Sub-section: ${item.client_boq_section} > ${item.client_boq_sub_section}`;
    } else if (item.client_boq_section) {
      initialText = `Header: ${item.client_boq_section}`;
    } else if (item.client_boq_item_id) {
      const matched = clientItems.find(c => c.id === item.client_boq_item_id);
      initialText = matched ? `Item: ${matched.item_code} - ${matched.description}` : 'Unknown Item';
    }
    setMappingSearchText(initialText);
    setShowMappingDropdown(false);
    setShowModal(true);
  };

  const handleDeleteClick = (itemId: string, itemCode: string) => {
    try {
      // Pre-check validation before confirming
      const poLines = db.getPOLines ? db.getPOLines() : [];
      const isReferenced = poLines.some((line: any) => line.boq_item_id === itemId);
      if (isReferenced) {
        alert("This BOQ item cannot be deleted because it is already referenced in one or more Purchase Orders. Please delete those Purchase Order lines first.");
        return;
      }

      if (confirm(`Are you sure you want to delete BOQ line item "${itemCode}"? This will permanently remove it from the system.`)) {
        if (confirm(`⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting BOQ line item "${itemCode}"?`)) {
          db.deleteBOQItem(itemId);
          loadItems();
        }
      }
    } catch (error: any) {
      alert(error.message || "An error occurred while deleting the BOQ item.");
    }
  };

  const handleBulkDelete = () => {
    const idsToDelete = Object.keys(selectedItems).filter(id => selectedItems[id]);
    if (idsToDelete.length === 0) return;

    try {
      // Pre-check validation before confirming
      const poLines = db.getPOLines ? db.getPOLines() : [];
      const referencedCodes: string[] = [];
      idsToDelete.forEach(id => {
        const item = items.find(i => i.id === id);
        const isReferenced = poLines.some((line: any) => line.boq_item_id === id);
        if (isReferenced && item) {
          referencedCodes.push(item.item_code);
        }
      });

      if (referencedCodes.length > 0) {
        alert(`Cannot delete selected items. The following items are referenced in Purchase Orders:\n- ${referencedCodes.join('\n- ')}\n\nPlease remove these items from Purchase Orders first.`);
        return;
      }

      if (confirm(`Are you sure you want to delete the ${idsToDelete.length} selected BOQ items? This will permanently remove them from the system.`)) {
        if (confirm(`⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting ${idsToDelete.length} selected BOQ items?`)) {
          idsToDelete.forEach(id => db.deleteBOQItem(id));
          setSelectedItems({});
          loadItems();
        }
      }
    } catch (error: any) {
      alert(error.message || "An error occurred during bulk deletion.");
    }
  };

  const handleOpenBulkLink = () => {
    const selectedIds = Object.keys(selectedItems).filter(id => selectedItems[id]);
    // Pre-populate map with current linkings
    const initMap: { [id: string]: string } = {};
    selectedIds.forEach(id => {
      const item = items.find((i: any) => i.id === id);
      initMap[id] = item?.client_boq_sub_section ? `subsection::${item.client_boq_section}::${item.client_boq_sub_section}` : (item?.client_boq_section ? `section::${item.client_boq_section}` : (item?.client_boq_item_id ? `item::${item.client_boq_item_id}` : ''));
    });
    setBulkLinkMap(initMap);
    setBulkLinkGlobal('__keep__');
    setBulkLinkSearchQuery('');
    setShowBulkLinkDropdown(false);
    setShowBulkLinkModal(true);
  };

  const handleSaveBulkLink = () => {
    const finalMap = { ...bulkLinkMap };
    // Apply global override if the user set one
    if (bulkLinkGlobal !== '__keep__') {
      Object.keys(finalMap).forEach(id => { finalMap[id] = bulkLinkGlobal; });
    }

    // Apply mappings individually
    Object.entries(finalMap).forEach(([itemId, val]) => {
      let clientItemId: string | null = null;
      let clientSection: string | null = null;
      let clientSubSection: string | null = null;

      if (val.startsWith('subsection::')) {
        const parts = val.replace('subsection::', '').split('::');
        clientSection = parts[0];
        clientSubSection = parts[1] || '';
      } else if (val.startsWith('section::')) {
        clientSection = val.replace('section::', '');
      } else if (val.startsWith('item::')) {
        clientItemId = val.replace('item::', '');
      } else if (val) {
        clientItemId = val;
      }

      db.bulkLinkBOQItems([itemId], clientItemId, clientSection, clientSubSection);
    });

    setShowBulkLinkModal(false);
    setSelectedItems({});
    loadItems();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;

    const projectItems = items.filter(item => item.project_id === activeProjectId);
    const maxSortOrder = projectItems.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);

    const saved = db.saveBOQItem({
      ...formData,
      project_id: activeProjectId,
      id: editingId || undefined,
      sort_order: editingId ? (projectItems.find(i => i.id === editingId)?.sort_order ?? 0) : maxSortOrder + 10
    });

    if (formData.is_manpower_cost) {
      db.saveManpowerLinksForInternalItem(saved.id, selectedClientBOQIds);
    } else {
      db.saveManpowerLinksForInternalItem(saved.id, []);
    }

    handleCloseModal();
    loadItems();
  };

  // --- CSV Import Handlers ---
  const downloadTemplate = () => {
    const headers = 'section,sub_section,item_code,description,unit,planned_qty,approved_qty,unit_rate,vat_rate,client_item_code\n';
    const row1 = 'Landscaping Works,Ground Works,BOQ-1.1,"Premium Turf Grass Sodding (Paspalum)",SQM,6000,5000,4.500,5.0,C-BOQ-1\n';
    const row2 = 'Irrigation & Piping,Piping,BOQ-1.2,"Automatic Drip Irrigation Pipes - 16mm",L.M,2000,1800,0.850,5.0,C-BOQ-2\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + row1 + row2);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'boq_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCSV = () => {
    if (!activeProject || items.length === 0) return;

    const grouped = items.reduce((acc: { [key: string]: any[] }, item) => {
      const sec = item.section || 'General Works';
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(item);
      return acc;
    }, {});

    let csvContent = 'DIMAH AL RAEDAH SPC - BOQ Export\n';
    csvContent += `Project:,"${activeProject.name}"\n`;
    csvContent += `Location:,"${activeProject.site_location}"\n`;
    csvContent += `Currency:,OMR (Oman Rial)\n\n`;
    csvContent += 'Section,Sub Section,Item Code,Description,Unit,Planned Qty,Approved Qty,Unit Rate,VAT Rate (%),Subtotal (Excl. VAT),Subtotal (Incl. VAT)\n';

    Object.keys(grouped).forEach(sectionName => {
      const groupItems = grouped[sectionName];
      groupItems.forEach(item => {
        const subtotal = item.approved_qty * item.unit_rate;
        const subtotalIncl = subtotal * (1 + item.vat_rate / 100);
        const descEscaped = item.description.replace(/"/g, '""');
        const secEscaped = sectionName.replace(/"/g, '""');
        const subSecEscaped = (item.sub_section || 'General').replace(/"/g, '""');
        csvContent += `"${secEscaped}","${subSecEscaped}",${item.item_code},"${descEscaped}",${item.unit},${item.planned_qty},${item.approved_qty},${item.unit_rate},${item.vat_rate},${subtotal.toFixed(3)},${subtotalIncl.toFixed(3)}\n`;
      });
      const secSubtotal = groupItems.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate), 0);
      const secSubtotalIncl = groupItems.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate * (1 + item.vat_rate / 100)), 0);
      csvContent += `"${sectionName.replace(/"/g, '""')} TOTAL",,,,,,,,${secSubtotal.toFixed(3)},${secSubtotalIncl.toFixed(3)}\n\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeProject.name.replace(/\s+/g, '_')}_BOQ.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setImportErrors(["CSV file must contain a header row and at least one data row."]);
          setShowImportModal(true);
          return;
        }

        const normalizeHeader = (h: string) => {
          return h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        };

        const headers = rows[0].map(normalizeHeader);
        const dataRows = rows.slice(1);
        const requiredHeaders = ['description', 'unit', 'plannedqty', 'approvedqty', 'unitrate'];
        const missing = requiredHeaders.filter(req => !headers.includes(req));
        if (missing.length > 0) {
          setImportErrors([`Missing required headers: ${missing.join(', ')}. Header row must contain these columns.`]);
          setShowImportModal(true);
          return;
        }

        const parsedItems: any[] = [];
        const errors: string[] = [];
        const dbItems = db.getBOQWorkflowSummary(activeProjectId);
        const uniqueSections = Array.from(new Set(dbItems.map(item => item.section || 'General Works')));

        const getImportedAutoCode = (sectionName: string, currentlyParsedItems: any[]) => {
          const sec = sectionName || 'General Works';
          if (!uniqueSections.includes(sec)) {
            uniqueSections.push(sec);
          }
          const secIndex = uniqueSections.indexOf(sec) + 1;
          const dbCount = dbItems.filter(item => (item.section || 'General Works') === sec).length;
          const parsedCount = currentlyParsedItems.filter(item => (item.section || 'General Works') === sec).length;
          return `BOQ-${secIndex}.${dbCount + parsedCount + 1}`;
        };

        dataRows.forEach((row, idx) => {
          if (row.length === 0 || row.every(val => val.replace(/[\s\uFEFF\u00A0]+/g, '') === "")) {
            return;
          }

          const getVal = (headerName: string) => {
            const index = headers.indexOf(headerName.replace(/[\s_-]+/g, ''));
            return index >= 0 ? row[index]?.trim() : "";
          };

          const section = getVal('section') || 'General Works';
          const sub_section = getVal('sub_section') || 'General';
          let item_code = getVal('item_code');
          if (!item_code) {
            item_code = getImportedAutoCode(section, parsedItems);
          }
          const description = getVal('description');
          if (!description || description.trim() === "") {
            return;
          }

          const unit = getVal('unit');
          const planned_qty_str = getVal('planned_qty');
          const approved_qty_str = getVal('approved_qty');
          const unit_rate_str = getVal('unit_rate');
          const vat_rate_str = getVal('vat_rate') || "5.0";
          const lineNum = idx + 2;

          if (!unit) {
            errors.push(`Row ${lineNum}: Missing 'unit'`);
          }

          let planned_qty = parseFloat(planned_qty_str);
          if (isNaN(planned_qty)) {
            const norm = planned_qty_str.toLowerCase().trim();
            if (norm === 'ls' || norm === 'l.s.' || norm === 'l/s' || norm === 'lump sum' || planned_qty_str === "") {
              planned_qty = 1;
            } else {
              errors.push(`Row ${lineNum}: Invalid planned_qty (${planned_qty_str})`);
            }
          }

          let approved_qty = parseFloat(approved_qty_str);
          if (isNaN(approved_qty)) {
            const norm = approved_qty_str.toLowerCase().trim();
            if (norm === 'ls' || norm === 'l.s.' || norm === 'l/s' || norm === 'lump sum' || approved_qty_str === "") {
              approved_qty = 1;
            } else {
              errors.push(`Row ${lineNum}: Invalid approved_qty (${approved_qty_str})`);
            }
          }

          let unit_rate = parseFloat(unit_rate_str);
          if (isNaN(unit_rate) || unit_rate < 0) {
            errors.push(`Row ${lineNum}: Invalid unit_rate (${unit_rate_str})`);
          }

          let vat_rate = parseFloat(vat_rate_str);
          if (isNaN(vat_rate) || vat_rate < 0) {
            errors.push(`Row ${lineNum}: Invalid vat_rate (${vat_rate_str})`);
          }

          const client_item_code = getVal('client_item_code');
          let client_boq_item_id = '';
          if (client_item_code) {
            const matchedClient = clientItems.find(c => c.item_code.toLowerCase().trim() === client_item_code.toLowerCase().trim());
            if (matchedClient) {
              client_boq_item_id = matchedClient.id;
            }
          }

          const existingItem = dbItems.find(dbItem =>
            dbItem.item_code.toLowerCase().trim() === item_code.toLowerCase().trim() ||
            dbItem.description.toLowerCase().trim() === description.toLowerCase().trim()
          );

          if (item_code && description && unit && !isNaN(planned_qty) && !isNaN(approved_qty) && !isNaN(unit_rate) && !isNaN(vat_rate)) {
            parsedItems.push({
              id: existingItem ? existingItem.id : undefined,
              is_update: !!existingItem,
              section,
              sub_section,
              item_code,
              description,
              unit,
              planned_qty,
              approved_qty,
              unit_rate,
              vat_rate,
              client_item_code,
              client_boq_item_id
            });
          }
        });

        setImportPreview(parsedItems);
        setImportErrors(errors);
        setShowImportModal(true);
      } catch (err) {
        setImportErrors([`Failed to parse CSV: ${(err as Error).message}`]);
        setShowImportModal(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    if (!activeProjectId) return;

    const projectItems = items.filter(item => item.project_id === activeProjectId);
    const maxSortOrder = projectItems.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);

    importPreview.forEach((item, idx) => {
      const { is_update, ...savePayload } = item;
      const existing = projectItems.find(i => i.id === item.id);
      db.saveBOQItem({
        ...savePayload,
        project_id: activeProjectId,
        sort_order: existing ? (existing.sort_order ?? 0) : maxSortOrder + (idx + 1) * 10
      });
    });

    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    loadItems();
  };

  // --- Client BOQ CSV Import Handlers ---
  const downloadClientTemplate = () => {
    const headers = 'section,sub_section,item_code,description,unit,qty,unit_rate,value\n';
    const row1 = 'Civil Works,Foundation,C-BOQ-1,"Civil works including concrete foundation",LS,1,12500.500,12500.500\n';
    const row2 = 'MEP Works,Piping,C-BOQ-2,"MEP Installation & Piping Works",LS,1,8900.000,8900.000\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + row1 + row2);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'client_boq_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClientFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setClientImportErrors(["File must contain a header row and at least one data row."]);
          setShowClientImportModal(true);
          return;
        }

        const normalizeHeader = (h: string) => {
          return h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        };

        const headers = rows[0].map(normalizeHeader);
        const dataRows = rows.slice(1);
        const requiredHeaders = ['itemcode', 'description', 'value'];
        const missing = requiredHeaders.filter(req => !headers.includes(req));
        if (missing.length > 0) {
          setClientImportErrors([`Missing required headers: ${missing.join(', ')}. Header row must contain 'item_code', 'description', and 'value'.`]);
          setShowClientImportModal(true);
          return;
        }

        const parsedItems: any[] = [];
        const errors: string[] = [];
        const dbClientItems = db.getClientBOQItems(activeProjectId);

        dataRows.forEach((row, idx) => {
          if (row.length === 1 && row[0] === "") return; // skip empty lines

          const getVal = (headerName: string) => {
            const hIdx = headers.indexOf(headerName);
            return hIdx !== -1 ? row[hIdx]?.trim() : '';
          };

          const section = getVal('section') || 'General';
          const sub_section = getVal('subsection') || getVal('sub_section') || 'General';
          const item_code = getVal('itemcode');
          const description = getVal('description');
          const unit = getVal('unit') || 'LS';
          const qty_str = getVal('qty') || '1';
          const unit_rate_str = getVal('unit_rate') || getVal('unitrate');
          const value_str = getVal('value');
          const lineNum = idx + 2;

          if (!item_code) {
            errors.push(`Row ${lineNum}: Missing 'item_code'`);
          }
          if (!description) {
            errors.push(`Row ${lineNum}: Missing 'description'`);
          }

          let qty = parseFloat(qty_str);
          if (isNaN(qty) || qty < 0) {
            errors.push(`Row ${lineNum}: Invalid qty (${qty_str})`);
            qty = 1.000;
          }

          let value = parseFloat(value_str);
          if (isNaN(value) || value < 0) {
            errors.push(`Row ${lineNum}: Invalid contract value (${value_str})`);
          }

          let unit_rate = parseFloat(unit_rate_str);
          if (isNaN(unit_rate) || unit_rate < 0) {
            unit_rate = qty > 0 ? value / qty : 0;
          }

          const existingItem = dbClientItems.find(dbItem =>
            dbItem.item_code.toLowerCase().trim() === item_code.toLowerCase().trim()
          );

          if (item_code && description && !isNaN(value)) {
            parsedItems.push({
              id: existingItem ? existingItem.id : undefined,
              is_update: !!existingItem,
              has_conflict: !!existingItem,
              existing_id: existingItem ? existingItem.id : undefined,
              section,
              sub_section,
              item_code,
              description,
              unit,
              qty,
              unit_rate,
              value
            });
          }
        });

        setClientImportPreview(parsedItems);
        setClientImportErrors(errors);
        setShowClientImportModal(true);
      } catch (err) {
        setClientImportErrors([`Failed to parse CSV file: ${(err as Error).message}`]);
        setShowClientImportModal(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClientImportConfirm = () => {
    if (!activeProjectId) return;

    const projectClientItems = clientItems.filter(item => item.project_id === activeProjectId);
    const maxSortOrder = projectClientItems.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);

    clientImportPreview.forEach((item, idx) => {
      const { is_update, has_conflict, existing_id, ...savePayload } = item;
      const existing = projectClientItems.find(i => i.id === existing_id);
      db.saveClientBOQItem({
        ...savePayload,
        project_id: activeProjectId,
        sort_order: existing ? (existing.sort_order ?? 0) : maxSortOrder + (idx + 1) * 10
      });
    });

    setShowClientImportModal(false);
    setClientImportPreview([]);
    setClientImportErrors([]);
    loadItems();
  };

  const addSampleBOQ = () => {
    if (!activeProjectId) return;

    const samples = [
      {
        project_id: activeProjectId,
        item_code: 'BOQ-EXT-01',
        description: 'Excavation in hard soil including dressing sides & ramming',
        section: 'Civil & Earthworks',
        unit: 'CUM',
        planned_qty: 1500,
        approved_qty: 1200,
        unit_rate: 5.500,
        vat_rate: 5.0
      },
      {
        project_id: activeProjectId,
        item_code: 'BOQ-CONC-02',
        description: 'Ready-mix concrete C30/20 grade in foundation',
        section: 'Civil & Earthworks',
        unit: 'CUM',
        planned_qty: 450,
        approved_qty: 400,
        unit_rate: 35.000,
        vat_rate: 5.0
      },
      {
        project_id: activeProjectId,
        item_code: 'BOQ-IRR-03',
        description: 'Submersible Water Pump - 5.5 HP (Pedrollo Italy)',
        section: 'Irrigation & Piping',
        unit: 'NOS',
        planned_qty: 5,
        approved_qty: 4,
        unit_rate: 420.000,
        vat_rate: 5.0
      },
      {
        project_id: activeProjectId,
        item_code: 'BOQ-STONE-04',
        description: 'Imported Indian Granite cladding for exterior water feature',
        section: 'Finishing Works',
        unit: 'SQM',
        planned_qty: 120,
        approved_qty: 100,
        unit_rate: 28.000,
        vat_rate: 5.0
      }
    ];

    samples.forEach((s, idx) => db.saveBOQItem({ ...s, sort_order: (idx + 1) * 10 }));
    loadItems();
  };

  // --- Client BOQ Setup Handlers ---
  const handleClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClientFormData(prev => {
      const updated = {
        ...prev,
        [name]: ['value', 'qty', 'unit_rate'].includes(name) ? parseFloat(value) || 0 : value
      };

      // Auto-compute value (subtotal) if qty or unit_rate changes
      if (name === 'qty' || name === 'unit_rate') {
        updated.value = Number((updated.qty * updated.unit_rate).toFixed(3));
      }

      return updated;
    });
  };

  const handleClientCreateClick = () => {
    setClientFormData({
      item_code: `C-BOQ-${clientItems.length + 1}`,
      description: '',
      value: 0,
      section: 'General',
      sub_section: 'General',
      unit: 'LS',
      qty: 1.000,
      unit_rate: 0
    });
    setEditingClientId(null);
    setShowClientModal(true);
  };

  const handleClientEditClick = (item: ClientBOQItem) => {
    setClientFormData({
      item_code: item.item_code,
      description: item.description,
      value: item.value,
      section: item.section || 'General',
      sub_section: item.sub_section || 'General',
      unit: item.unit || 'LS',
      qty: item.qty !== undefined && item.qty !== null ? item.qty : 1.000,
      unit_rate: item.unit_rate !== undefined && item.unit_rate !== null ? item.unit_rate : (item.qty ? item.value / item.qty : 0)
    });
    setEditingClientId(item.id);
    setShowClientModal(true);
  };

  const handleClientDeleteClick = (id: string) => {
    if (confirm('Are you sure you want to delete this Client BOQ item? All internal mappings will be unlinked.')) {
      if (confirm('⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting this Client BOQ item?')) {
        db.deleteClientBOQItem(id);
        loadItems();
      }
    }
  };

  const handleClientBulkDelete = () => {
    const idsToDelete = Object.keys(selectedClientItems).filter(id => selectedClientItems[id]);
    if (idsToDelete.length === 0) return;

    try {
      if (confirm(`Are you sure you want to delete the ${idsToDelete.length} selected Client BOQ items? All internal mappings for these items will be unlinked.`)) {
        if (confirm(`⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting ${idsToDelete.length} selected Client BOQ items?`)) {
          idsToDelete.forEach(id => db.deleteClientBOQItem(id));
          setSelectedClientItems({});
          loadItems();
        }
      }
    } catch (error: any) {
      alert(error.message || "An error occurred during client bulk deletion.");
    }
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;

    const projectClientItems = clientItems.filter(item => item.project_id === activeProjectId);
    const maxSortOrder = projectClientItems.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);

    db.saveClientBOQItem({
      ...clientFormData,
      project_id: activeProjectId,
      id: editingClientId || undefined,
      sort_order: editingClientId ? (projectClientItems.find(i => i.id === editingClientId)?.sort_order ?? 0) : maxSortOrder + 10
    });

    setShowClientModal(false);
    loadItems();
  };

  // --- Claim Report Calculation Logic ---
  const getClaimReportData = () => {
    if (!activeProjectId) return [];

    const allClaims = db.getClientClaims(activeProjectId);
    const sortedPriorClaims = allClaims
      .filter(c => new Date(c.claim_date) <= new Date(claimDate))
      .sort((a, b) => new Date(a.claim_date).getTime() - new Date(b.claim_date).getTime());

    const prevClaimedMap: { [clientBOQId: string]: number } = {};
    sortedPriorClaims.forEach(c => {
      const lines = db.getClientClaimLines(c.id);
      lines.forEach(l => {
        prevClaimedMap[l.client_boq_item_id] = (prevClaimedMap[l.client_boq_item_id] || 0) + l.claim_amount;
      });
    });

    const manpowerLinks = db.getManpowerLinks();
    return clientItems.map(c => {
      const mappedInternals = items.filter(i => {
        if (i.is_manpower_cost) {
          return manpowerLinks.some(link => link.internal_boq_item_id === i.id && link.client_boq_item_id === c.id);
        }
        if (i.client_boq_item_id === c.id) return true;
        if (i.client_boq_item_id) return false;
        if (i.client_boq_section === c.section && c.section) {
          if (i.client_boq_sub_section) {
            return i.client_boq_sub_section === c.sub_section;
          }
          return true;
        }
        return false;
      });
      let totalInternalValue = 0;
      let executedValue = 0;

      mappedInternals.forEach(i => {
        if (i.is_manpower_cost) {
          const links = db.getManpowerLinks(i.id);
          const totalWeight = links.reduce((sum, l) => sum + (l.allocation_weight || 0), 0);
          const link = links.find(l => l.client_boq_item_id === c.id);
          if (link && totalWeight > 0) {
            const weight = link.allocation_weight || 0;
            const fullValue = i.approved_qty * i.unit_rate;
            const allocatedValue = fullValue * (weight / totalWeight);
            totalInternalValue += allocatedValue;

            const progressPercent = db.getClientBOQProgressPercent(c.id, claimDate);
            executedValue += allocatedValue * (progressPercent / 100);
          }
        } else {
          totalInternalValue += i.approved_qty * i.unit_rate;
          executedValue += db.getBOQExecutedValue(i.id, claimDate);
        }
      });

      const progressPercent = totalInternalValue > 0 ? (executedValue / totalInternalValue) * 100 : 0;
      const totalClaimable = c.value * (progressPercent / 100);
      const prevClaimed = prevClaimedMap[c.id] || 0;
      const calculatedClaim = Math.max(0, totalClaimable - prevClaimed);
      const currentClaim = editedClaims[c.id] !== undefined ? editedClaims[c.id] : calculatedClaim;
      const balanceAmount = currentClaim - prevClaimed;

      return {
        ...c,
        mappedInternals,
        totalInternalValue,
        executedValue,
        progressPercent,
        totalClaimable,
        prevClaimed,
        currentClaim,
        balanceAmount
      };
    });
  };

  const handleRecordClaim = () => {
    if (!activeProjectId) return;
    const reportData = getClaimReportData();

    const claimLines = reportData.map(r => ({
      client_boq_item_id: r.id,
      claim_amount: Math.max(0, r.currentClaim)
    }));

    if (claimLines.reduce((sum, l) => sum + l.claim_amount, 0) === 0) {
      alert("No claimable value detected for this date.");
      return;
    }

    if (confirm(`Do you want to submit and record the Client Claim for date: ${claimDate}?`)) {
      db.saveClientClaim(
        {
          project_id: activeProjectId,
          claim_date: claimDate
        },
        claimLines
      );
      alert("Client Claim saved successfully!");
      loadItems();
    }
  };

  const handleDeleteClaim = (claimId: string) => {
    if (confirm("Are you sure you want to delete this historical claim record? This will adjust previous claim values.")) {
      if (confirm("⚠️ WARNING: This action is permanent and cannot be undone. Are you absolutely sure you want to proceed with deleting this claim record?")) {
        db.deleteClientClaim(claimId);
        loadItems();
      }
    }
  };

  if (!activeProject) {
    return <div className="card">Please select a project to manage BOQ items.</div>;
  }

  // Totals calculations
  const totalExcl = items.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate), 0);
  const totalVat = items.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate * (item.vat_rate / 100)), 0);
  const existingSections = Array.from(new Set(items.map(item => item.section || 'General Works').filter(Boolean))) as string[];
  const existingSubSections = Array.from(new Set(items.map(item => item.sub_section || 'General').filter(Boolean))) as string[];
  const existingClientSections = Array.from(new Set(clientItems.map(item => item.section || 'General').filter(Boolean))) as string[];
  const existingClientSubSections = Array.from(new Set(clientItems.map(item => item.sub_section || 'General').filter(Boolean))) as string[];

  const claimReportItems = getClaimReportData();
  const totalClientBOQValue = clientItems.reduce((sum, i) => sum + i.value, 0);

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;
  const selectedClientCount = Object.values(selectedClientItems).filter(Boolean).length;

  return (
    <div className="boq-page-wrapper">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-title-group">
          <h1>BOQ & Client Claim Module</h1>
          <p>Cost Sheet (Internal BOQ) costing, Client BOQ setup, and progress-based claims tracking</p>
        </div>

        {activeTab === 'internal' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {canEditBOQ && (
              <button onClick={downloadTemplate} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                📥 Download Template
              </button>
            )}
            {canEditBOQ && (
              <label className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0 }}>
                📤 Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            <button onClick={exportToCSV} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📊 Export BOQ
            </button>

            {canEditBOQ && selectedCount > 0 && (
              <>
                <button
                  onClick={handleOpenBulkLink}
                  className="btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: 'white' }}
                >
                  🔗 Link Selected ({selectedCount})
                </button>
                <button onClick={handleBulkDelete} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }}>
                  🗑️ Delete Selected ({selectedCount})
                </button>
              </>
            )}

            {canEditBOQ && (
              <button onClick={handleCreateClick} className="btn btn-primary">
                + Add BOQ Item
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.75rem' }}>
              {dbProject?.boq_approved ? (
                <>
                  <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    ✅ Approved (Frozen)
                  </span>
                  {currentUser?.username?.toLowerCase() === 'kumaresan' ? (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to undo approval and unfreeze the BOQ rates/quantities?')) {
                          try {
                            db.undoApproveBOQ(activeProjectId, currentUser?.username || 'kumaresan');
                            loadItems();
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }
                      }}
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', borderColor: '#ef4444', color: '#ef4444', background: '#fff', height: 'auto', minHeight: 'unset' }}
                    >
                      Undo
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                      (Kumaresan only)
                    </span>
                  )}

                  {dbProject?.signed_boq_name ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.4rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.4rem' }}>
                      <a
                        href={dbProject.signed_boq_copy || '#'}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={dbProject.signed_boq_name}
                      >
                        📄 {dbProject.signed_boq_name}
                      </a>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to remove the signed BOQ copy?')) {
                            db.uploadSignedBOQ(activeProjectId, null, null);
                            loadItems();
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem 0.2rem', fontSize: '0.75rem' }}
                        title="Remove signed copy"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <label
                      className="btn btn-outline"
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        height: 'auto',
                        minHeight: 'unset',
                        margin: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        borderColor: '#059669',
                        color: '#059669',
                        background: '#fff'
                      }}
                    >
                      📁 Upload Signed BOQ
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              db.uploadSignedBOQ(activeProjectId, file.name, base64);
                              loadItems();
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to approve this BOQ? This will freeze rates and quantities for variation calculations.')) {
                      db.approveBOQ(activeProjectId, currentUser?.username || 'System User');
                      loadItems();
                    }
                  }}
                  className="btn btn-outline"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0.25rem 0.5rem', fontSize: '0.72rem', height: 'auto', minHeight: 'unset' }}
                >
                  ✔️ Approve BOQ
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'client_setup' && canEditBOQ && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={downloadClientTemplate} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📥 Download Template
            </button>
            <label className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0 }}>
              📤 Import Client BOQ
              <input
                type="file"
                accept=".csv"
                onChange={handleClientFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            {selectedClientCount > 0 && (
              <button onClick={handleClientBulkDelete} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }}>
                🗑️ Delete Selected ({selectedClientCount})
              </button>
            )}
            <button onClick={handleClientCreateClick} className="btn btn-primary">
              + Add Client BOQ Item
            </button>
          </div>
        )}

        {activeTab === 'claim_report' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Claim Date:</span>
              <input
                type="date"
                value={claimDate}
                onChange={(e) => {
                  setClaimDate(e.target.value);
                  setEditedClaims({});
                }}
                className="form-control"
                style={{ padding: '0.35rem 0.5rem', width: '160px' }}
              />
            </div>
            <button onClick={() => {
              setShowReportPreview(true);
              const totalVal = clientItems.reduce((sum, item) => sum + item.value, 0);
              setAdvanceReceived(totalVal * 0.1);
            }} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📄 View Professional Report
            </button>
            {canEditBOQ && (
              <button onClick={handleRecordClaim} className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                📥 Record Claim
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation Menu */}
      <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('internal')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'internal' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'internal' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          📋 Cost Sheet BOQ ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('client_setup')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'client_setup' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'client_setup' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          🤝 Work order BOQ ({clientItems.length})
        </button>
        <button
          onClick={() => setActiveTab('claim_report')}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'claim_report' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'claim_report' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          💰 Client Claim Report & History
        </button>
      </div>

      {/* TAB CONTENT: 1. INTERNAL BOQ */}
      {activeTab === 'internal' && (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card stat-card">
              <span className="stat-title">Total BOQ Items</span>
              <span className="stat-value">{items.length} Lines</span>
            </div>
            <div className="card stat-card secondary">
              <span className="stat-title">BOQ Value (Excl. VAT)</span>
              <span className="stat-value">OMR {totalExcl.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
            </div>
            <div className="card stat-card success">
              <span className="stat-title">VAT Amount (5%)</span>
              <span className="stat-value">OMR {totalVat.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
            </div>
            <div className="card stat-card accent">
              <span className="stat-title">Grand Total (Incl. VAT)</span>
              <span className="stat-value">OMR {(totalExcl + totalVat).toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="🔍 Search BOQ item code, description or section..."
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
                  <th style={{ width: '30px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every(item => !!selectedItems[item.id])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const newSelected = { ...selectedItems };
                        items.forEach(item => {
                          newSelected[item.id] = checked;
                        });
                        setSelectedItems(newSelected);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: '8%', minWidth: '70px' }}>Item Code</th>
                  <th style={{ width: '22%', minWidth: '180px' }}>Description</th>
                  <th style={{ width: '5%', minWidth: '45px' }}>Unit</th>
                  <th style={{ width: '8%', minWidth: '75px', textAlign: 'right' }}>Unit Rate</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>Planned</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>Approved</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>Ordered</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>Received</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>Consumed</th>
                  <th style={{ width: '6%', minWidth: '60px', textAlign: 'right' }}>Stock Bal</th>
                  <th style={{ width: '6%', minWidth: '55px', textAlign: 'right' }}>BOQ Bal</th>
                  <th style={{ width: '9%', minWidth: '90px', textAlign: 'right' }}>Mapped Client BOQ</th>
                  <th style={{ width: '9%', minWidth: '90px', textAlign: 'right' }}>Subtotal (Excl)</th>
                  <th style={{ width: '10%', minWidth: '95px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = items.filter(item =>
                    item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.section || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.sub_section || '').toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          {items.length === 0
                            ? 'No BOQ items set up. Click "+ Add BOQ Item" or "Import CSV" to begin.'
                            : 'No matching BOQ items found.'}
                        </td>
                      </tr>
                    );
                  }

                  const grouped = filtered.reduce((acc: { [sec: string]: { [subSec: string]: any[] } }, item) => {
                    const sec = item.section || 'General Works';
                    const subSec = item.sub_section || 'General';
                    if (!acc[sec]) acc[sec] = {};
                    if (!acc[sec][subSec]) acc[sec][subSec] = [];
                    acc[sec][subSec].push(item);
                    return acc;
                  }, {});

                  return Object.keys(grouped).map((sectionName) => {
                    const subSections = grouped[sectionName];
                    const sectionItems = Object.values(subSections).flat();
                    const sectionTotal = sectionItems.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate), 0);
                    const isSecCollapsed = !!collapsedSections[sectionName];

                    return (
                      <React.Fragment key={sectionName}>
                        {/* Main Section Header */}
                        <tr
                          onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
                          style={{ backgroundColor: 'var(--secondary-light)', borderLeft: '5px solid var(--secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={sectionItems.length > 0 && sectionItems.every(item => !!selectedItems[item.id])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const newSelected = { ...selectedItems };
                                sectionItems.forEach(item => {
                                  newSelected[item.id] = checked;
                                });
                                setSelectedItems(newSelected);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td colSpan={12} style={{ fontWeight: '800', color: 'var(--secondary-hover)', padding: '0.75rem 0.8rem', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{isSecCollapsed ? '▶' : '▼'} 📁 {sectionName}</span>
                              {canEditBOQ && !searchQuery && (
                                <div style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleMoveSection(sectionName, 'up')}
                                    className="btn btn-outline"
                                    style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
                                    title="Move Section Up"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => handleMoveSection(sectionName, 'down')}
                                    className="btn btn-outline"
                                    style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
                                    title="Move Section Down"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--secondary-hover)', paddingRight: '0.8rem', fontSize: '0.85rem' }}>
                            OMR {sectionTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                          </td>
                          <td></td>
                        </tr>

                        {/* Subsections */}
                        {!isSecCollapsed && Object.keys(subSections).map((subSectionName) => {
                          const subSectionItems = subSections[subSectionName];
                          const subSectionTotal = subSectionItems.reduce((sum, item) => sum + (item.approved_qty * item.unit_rate), 0);
                          const subSecKey = `${sectionName}::${subSectionName}`;
                          const isSubCollapsed = !!collapsedSubSections[subSecKey];

                          return (
                            <React.Fragment key={subSectionName}>
                              {/* Subsection Subheader */}
                              <tr
                                onClick={() => setCollapsedSubSections(prev => ({ ...prev, [subSecKey]: !prev[subSecKey] }))}
                                style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                              >
                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={subSectionItems.length > 0 && subSectionItems.every(item => !!selectedItems[item.id])}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newSelected = { ...selectedItems };
                                      subSectionItems.forEach(item => {
                                        newSelected[item.id] = checked;
                                      });
                                      setSelectedItems(newSelected);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td colSpan={12} style={{ fontWeight: '600', color: 'var(--text-color)', padding: '0.5rem 1.5rem', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{isSubCollapsed ? '▶' : '▼'} 📂 {subSectionName}</span>
                                    {canEditBOQ && !searchQuery && (
                                      <div style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => handleMoveSubSection(sectionName, subSectionName, 'up')}
                                          className="btn btn-outline"
                                          style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid #94a3b8', color: '#64748b' }}
                                          title="Move Subsection Up"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          onClick={() => handleMoveSubSection(sectionName, subSectionName, 'down')}
                                          className="btn btn-outline"
                                          style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid #94a3b8', color: '#64748b' }}
                                          title="Move Subsection Down"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-color)', paddingRight: '0.8rem', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  OMR {subSectionTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                </td>
                                <td></td>
                              </tr>

                              {!isSubCollapsed && subSectionItems.map((item) => {
                                const clientBOQ = clientItems.find(c => c.id === item.client_boq_item_id);
                                return (
                                  <tr key={item.id}>
                                    <td style={{ textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={!!selectedItems[item.id]}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setSelectedItems(prev => ({ ...prev, [item.id]: checked }));
                                        }}
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ fontWeight: '600', paddingLeft: '1.5rem' }}>{item.item_code}</td>
                                    <td>
                                      {item.description}
                                      {/* Removed Manpower badge as requested */}
                                    </td>
                                    <td><span className="badge badge-draft">{item.unit}</span></td>
                                    <td style={{ textAlign: 'right' }}>{item.unit_rate.toFixed(3)}</td>
                                    <td style={{ textAlign: 'right' }}>{item.planned_qty}</td>
                                    <td style={{ textAlign: 'right', fontWeight: '500' }}>{item.approved_qty}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{item.ordered_qty.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--secondary)' }}>{item.received_qty.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{item.consumed_qty.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.stock_balance > 0 ? 'var(--success)' : 'inherit' }}>
                                      {item.stock_balance.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'right', color: item.boq_balance < 0 ? 'var(--danger)' : 'inherit' }}>
                                      {item.boq_balance.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', position: 'relative' }}>
                                      {item.is_manpower_cost ? (
                                        (() => {
                                          const manpowerLinks = db.getManpowerLinks(item.id);
                                          const linkedClientItems = manpowerLinks
                                            .map(l => clientItems.find(c => c.id === l.client_boq_item_id))
                                            .filter((c): c is ClientBOQItem => !!c);

                                          if (linkedClientItems.length === 0) return '-';

                                          return (
                                            <>
                                              <span
                                                onClick={() => setActiveLinkedInfoId(activeLinkedInfoId === item.id ? null : item.id)}
                                                style={{
                                                  cursor: 'pointer',
                                                  color: 'var(--primary)',
                                                  textDecoration: 'underline',
                                                  fontWeight: '600',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '0.15rem'
                                                }}
                                                title="Click to view linked client details"
                                              >
                                                ℹ️ Multi ({linkedClientItems.length})
                                              </span>

                                              {activeLinkedInfoId === item.id && (
                                                <div
                                                  style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    right: '10px',
                                                    zIndex: 100,
                                                    backgroundColor: 'white',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                    padding: '0.75rem',
                                                    width: '280px',
                                                    textAlign: 'left',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-color)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.4rem'
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem', marginBottom: '0.2rem' }}>
                                                    <strong style={{ color: 'var(--primary)' }}>
                                                      🔗 Linked Client Items ({linkedClientItems.length})
                                                    </strong>
                                                    <button
                                                      onClick={() => setActiveLinkedInfoId(null)}
                                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}
                                                    >
                                                      &times;
                                                    </button>
                                                  </div>
                                                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                    {linkedClientItems.map(c => (
                                                      <div key={c.id} style={{ fontSize: '0.75rem', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.2rem' }}>
                                                        <strong>{c.item_code}</strong>: {c.description.substring(0, 50)}... (OMR {c.value.toFixed(3)})
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()
                                      ) : (clientBOQ || item.client_boq_section || item.client_boq_sub_section) ? (
                                        <>
                                          <span
                                            onClick={() => setActiveLinkedInfoId(activeLinkedInfoId === item.id ? null : item.id)}
                                            style={{
                                              cursor: 'pointer',
                                              color: 'var(--primary)',
                                              textDecoration: 'underline',
                                              fontWeight: '600',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.15rem'
                                            }}
                                            title="Click to view linked client details"
                                          >
                                            ℹ️ {clientBOQ ? clientBOQ.item_code : item.client_boq_sub_section ? `📁 ${item.client_boq_section} > ${item.client_boq_sub_section}` : `📁 ${item.client_boq_section}`}
                                          </span>

                                          {activeLinkedInfoId === item.id && (
                                            <div
                                              style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: '10px',
                                                zIndex: 100,
                                                backgroundColor: 'white',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                padding: '0.75rem',
                                                width: '280px',
                                                textAlign: 'left',
                                                fontSize: '0.8rem',
                                                color: 'var(--text-color)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.4rem'
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem', marginBottom: '0.2rem' }}>
                                                <strong style={{ color: 'var(--primary)' }}>
                                                  {clientBOQ ? '🔗 Mapped Client Item' : item.client_boq_sub_section ? '📁 Mapped Client Sub-section' : '📁 Mapped Client Section'}
                                                </strong>
                                                <button
                                                  onClick={() => setActiveLinkedInfoId(null)}
                                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}
                                                >
                                                  &times;
                                                </button>
                                              </div>

                                              {clientBOQ ? (
                                                <>
                                                  <div><strong>Code:</strong> {clientBOQ.item_code}</div>
                                                  <div><strong>Description:</strong> {clientBOQ.description}</div>
                                                  <div><strong>Section:</strong> {clientBOQ.section || 'General'}</div>
                                                  {clientBOQ.sub_section && <div><strong>Sub Section:</strong> {clientBOQ.sub_section}</div>}
                                                  <div><strong>Unit:</strong> {clientBOQ.unit || 'LS'}</div>
                                                  <div><strong>Qty:</strong> {(clientBOQ.qty ?? 1.0).toFixed(3)}</div>
                                                  <div><strong>Unit Rate:</strong> OMR {(clientBOQ.unit_rate ?? 0).toFixed(3)}</div>
                                                  <div style={{ marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', color: 'var(--success)' }}>
                                                    Subtotal: OMR {clientBOQ.value.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                                  </div>
                                                </>
                                              ) : item.client_boq_sub_section ? (
                                                <>
                                                  <div><strong>Section Name:</strong> {item.client_boq_section}</div>
                                                  <div><strong>Sub Section:</strong> {item.client_boq_sub_section}</div>
                                                  <div style={{ marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', color: 'var(--success)' }}>
                                                    Sub Section Total: OMR {
                                                      clientItems
                                                        .filter(c => c.section === item.client_boq_section && c.sub_section === item.client_boq_sub_section)
                                                        .reduce((sum, c) => sum + c.value, 0)
                                                        .toLocaleString('en-US', { minimumFractionDigits: 3 })
                                                    }
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <div><strong>Section Name:</strong> {item.client_boq_section}</div>
                                                  <div style={{ marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', color: 'var(--success)' }}>
                                                    Section Total: OMR {
                                                      clientItems
                                                        .filter(c => c.section === item.client_boq_section)
                                                        .reduce((sum, c) => sum + c.value, 0)
                                                        .toLocaleString('en-US', { minimumFractionDigits: 3 })
                                                    }
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                      {(item.approved_qty * item.unit_rate).toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                    </td>
                                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      {canEditBOQ ? (
                                        <>
                                          {!searchQuery && (
                                            <div style={{ display: 'inline-flex', gap: '0.2rem', marginRight: '0.4rem' }}>
                                              <button
                                                onClick={() => handleMoveItem(item.id, 'up')}
                                                className="btn btn-outline"
                                                style={{ padding: '0.15rem 0.3rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                                title="Move Item Up"
                                              >
                                                ▲
                                              </button>
                                              <button
                                                onClick={() => handleMoveItem(item.id, 'down')}
                                                className="btn btn-outline"
                                                style={{ padding: '0.15rem 0.3rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                                title="Move Item Down"
                                              >
                                                ▼
                                              </button>
                                            </div>
                                          )}
                                          <button
                                            onClick={() => handleEditClick(item)}
                                            className="btn btn-outline"
                                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', marginRight: '0.3rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteClick(item.id, item.item_code)}
                                            className="btn btn-outline"
                                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', height: 'auto', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                                          >
                                            🗑️ Delete
                                          </button>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>👁 View only</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB CONTENT: 2. CLIENT BOQ SETUP */}
      {activeTab === 'client_setup' && (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card stat-card">
              <span className="stat-title">Client BOQ Items</span>
              <span className="stat-value">{clientItems.length} Items</span>
            </div>
            <div className="card stat-card secondary">
              <span className="stat-title">Client BOQ Value (Lump-Sum)</span>
              <span className="stat-value">OMR {totalClientBOQValue.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="🔍 Search Client BOQ code or scope..."
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
                  <th style={{ width: '3%', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={clientItems.length > 0 && clientItems.every(item => !!selectedClientItems[item.id])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const newSelected = { ...selectedClientItems };
                        clientItems.forEach(item => {
                          newSelected[item.id] = checked;
                        });
                        setSelectedClientItems(newSelected);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: '12%' }}>Client Item Code</th>
                  <th style={{ width: '30%' }}>Description / Scope</th>
                  <th style={{ width: '8%' }}>Unit</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Unit Rate</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Subtotal Value (OMR)</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = clientItems.filter(item =>
                    item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.section || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.sub_section || '').toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          {clientItems.length === 0
                            ? 'No Client BOQ items set up. Click "+ Add Client BOQ Item" to configure.'
                            : 'No matching Client BOQ items found.'}
                        </td>
                      </tr>
                    );
                  }

                  const groupedSections = filtered.reduce((acc: { [sec: string]: { [subSec: string]: ClientBOQItem[] } }, item) => {
                    const sec = item.section || 'General';
                    const subSec = item.sub_section || 'General';
                    if (!acc[sec]) acc[sec] = {};
                    if (!acc[sec][subSec]) acc[sec][subSec] = [];
                    acc[sec][subSec].push(item);
                    return acc;
                  }, {});

                  return Object.keys(groupedSections).map((sectionName) => {
                    const subSections = groupedSections[sectionName];
                    let sectionTotal = 0;
                    Object.keys(subSections).forEach(subSec => {
                      sectionTotal += subSections[subSec].reduce((sum, item) => sum + item.value, 0);
                    });
                    const isSecCollapsed = !!collapsedClientSections[sectionName];

                    return (
                      <React.Fragment key={sectionName}>
                        <tr
                          onClick={() => setCollapsedClientSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
                          style={{ backgroundColor: 'var(--secondary-light)', borderLeft: '4px solid var(--secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={
                                (() => {
                                  const allSecItems: ClientBOQItem[] = [];
                                  Object.keys(subSections).forEach(subSec => {
                                    allSecItems.push(...subSections[subSec]);
                                  });
                                  return allSecItems.length > 0 && allSecItems.every(item => !!selectedClientItems[item.id]);
                                })()
                              }
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const newSelected = { ...selectedClientItems };
                                Object.keys(subSections).forEach(subSec => {
                                  subSections[subSec].forEach(item => {
                                    newSelected[item.id] = checked;
                                  });
                                });
                                setSelectedClientItems(newSelected);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td colSpan={5} style={{ fontWeight: '700', color: 'var(--secondary-hover)', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{isSecCollapsed ? '▶' : '▼'} 📁 {sectionName}</span>
                              {canEditBOQ && !searchQuery && (
                                <div style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleMoveClientSection(sectionName, 'up')}
                                    className="btn btn-outline"
                                    style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
                                    title="Move Section Up"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => handleMoveClientSection(sectionName, 'down')}
                                    className="btn btn-outline"
                                    style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
                                    title="Move Section Down"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--secondary-hover)', paddingRight: '0.8rem', fontSize: '0.85rem' }}>
                            OMR {sectionTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                          </td>
                          <td></td>
                        </tr>

                        {!isSecCollapsed && Object.keys(subSections).map((subSectionName) => {
                          const subSectionItems = subSections[subSectionName];
                          const subSectionTotal = subSectionItems.reduce((sum, item) => sum + item.value, 0);
                          const subSecKey = `${sectionName}::${subSectionName}`;
                          const isSubCollapsed = !!collapsedClientSubSections[subSecKey];

                          return (
                            <React.Fragment key={subSecKey}>
                              {/* Subsection Subheader */}
                              <tr
                                onClick={() => setCollapsedClientSubSections(prev => ({ ...prev, [subSecKey]: !prev[subSecKey] }))}
                                style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #cbd5e1', cursor: 'pointer', userSelect: 'none' }}
                              >
                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={subSectionItems.length > 0 && subSectionItems.every(item => !!selectedClientItems[item.id])}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newSelected = { ...selectedClientItems };
                                      subSectionItems.forEach(item => {
                                        newSelected[item.id] = checked;
                                      });
                                      setSelectedClientItems(newSelected);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td colSpan={5} style={{ fontWeight: '600', color: 'var(--text-color)', padding: '0.5rem 1.5rem', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{isSubCollapsed ? '▶' : '▼'} 📂 {subSectionName}</span>
                                    {canEditBOQ && !searchQuery && (
                                      <div style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => handleMoveClientSubSection(sectionName, subSectionName, 'up')}
                                          className="btn btn-outline"
                                          style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid #94a3b8', color: '#64748b' }}
                                          title="Move Subsection Up"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          onClick={() => handleMoveClientSubSection(sectionName, subSectionName, 'down')}
                                          className="btn btn-outline"
                                          style={{ padding: '0.1rem 0.25rem', fontSize: '0.7rem', height: 'auto', border: '1px solid #94a3b8', color: '#64748b' }}
                                          title="Move Subsection Down"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-color)', paddingRight: '0.8rem', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  OMR {subSectionTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                </td>
                                <td></td>
                              </tr>

                              {!isSubCollapsed && subSectionItems.map((item) => (
                                <tr key={item.id}>
                                  <td style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!selectedClientItems[item.id]}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSelectedClientItems(prev => ({ ...prev, [item.id]: checked }));
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ fontWeight: '700', paddingLeft: '2.5rem' }}>{item.item_code}</td>
                                  <td>{item.description}</td>
                                  <td><span className="badge badge-draft">{item.unit || 'LS'}</span></td>
                                  <td style={{ textAlign: 'right' }}>{(item.qty !== undefined && item.qty !== null ? item.qty : 1.000).toFixed(3)}</td>
                                  <td style={{ textAlign: 'right' }}>{(item.unit_rate !== undefined && item.unit_rate !== null ? item.unit_rate : 0).toFixed(3)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                    OMR {item.value.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {canEditBOQ ? (
                                      <>
                                        {!searchQuery && (
                                          <div style={{ display: 'inline-flex', gap: '0.2rem', marginRight: '0.4rem' }}>
                                            <button
                                              onClick={() => handleMoveClientItem(item.id, 'up')}
                                              className="btn btn-outline"
                                              style={{ padding: '0.15rem 0.3rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                              title="Move Item Up"
                                            >
                                              ▲
                                            </button>
                                            <button
                                              onClick={() => handleMoveClientItem(item.id, 'down')}
                                              className="btn btn-outline"
                                              style={{ padding: '0.15rem 0.3rem', fontSize: '0.7rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                              title="Move Item Down"
                                            >
                                              ▼
                                            </button>
                                          </div>
                                        )}
                                        <button
                                          onClick={() => handleClientEditClick(item)}
                                          className="btn btn-outline"
                                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', marginRight: '0.3rem', height: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                        >
                                          ✏️ Edit
                                        </button>
                                        <button
                                          onClick={() => handleClientDeleteClick(item.id)}
                                          className="btn btn-outline"
                                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', height: 'auto', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                                        >
                                          🗑️ Delete
                                        </button>
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>👁 View only</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB CONTENT: 3. CLIENT CLAIM REPORT */}
      {activeTab === 'claim_report' && (
        <>
          {(() => {
            const totalClientValue = claimReportItems.reduce((sum, c) => sum + c.value, 0);
            const totalClientClaimedPrev = claimReportItems.reduce((sum, c) => sum + c.prevClaimed, 0);
            const totalClientClaimedCurrent = claimReportItems.reduce((sum, c) => {
              const curr = editedClaims[c.id] !== undefined ? editedClaims[c.id] : c.currentClaim;
              return sum + curr;
            }, 0);
            const totalClientClaimedNet = claimReportItems.reduce((sum, c) => {
              const curr = editedClaims[c.id] !== undefined ? editedClaims[c.id] : c.currentClaim;
              return sum + Math.max(0, curr - c.prevClaimed);
            }, 0);
            const totalClientRemaining = totalClientValue - totalClientClaimedCurrent;

            return (
              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="card stat-card secondary">
                  <span className="stat-title">Client Contract Value</span>
                  <span className="stat-value">OMR {totalClientValue.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                </div>
                <div className="card stat-card success">
                  <span className="stat-title">Previously Claimed (Cumulative)</span>
                  <span className="stat-value">OMR {totalClientClaimedPrev.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                </div>
                <div className="card stat-card accent">
                  <span className="stat-title">Net Claim (Current Period)</span>
                  <span className="stat-value">OMR {totalClientClaimedNet.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-title">Remaining Contract Balance</span>
                  <span className="stat-value">OMR {totalClientRemaining.toLocaleString('en-US', { minimumFractionDigits: 3 })}</span>
                </div>
              </div>
            );
          })()}

          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fdfdfd' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>💡 Instructions</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Select a <strong>Claim Date</strong>. The system will automatically aggregate progress on all internal BOQ items mapped under each lump-sum Client BOQ item, calculate progress %, apply it to the Client value, deduct previous claims recorded before the select date, and calculate the current claim.
            </p>
          </div>

          <div className="table-container" style={{ marginBottom: '2.5rem' }}>
            <table className="table table-compact">
              <thead>
                <tr>
                  <th style={{ width: '2%' }}></th>
                  <th style={{ width: '10%' }}>Client Code</th>
                  <th style={{ width: '20%' }}>Client Scope Description</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Client Value (A)</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Mapped Internal (B)</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Executed as of Date (C)</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Progress % (C/B)</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Claimable (A * %)</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Prev Claims (D)</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Current Claim</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {claimReportItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No Client BOQ items mapped. Setup Client BOQ items and link internal items to view claim report.
                    </td>
                  </tr>
                ) : (
                  claimReportItems.map((c) => {
                    const isExpanded = !!expandedClientBOQ[c.id];
                    return (
                      <React.Fragment key={c.id}>
                        {/* Summary Client Row */}
                        <tr style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ textAlign: 'center' }}>
                            {c.mappedInternals.length > 0 && (
                              <button
                                onClick={() => setExpandedClientBOQ(prev => ({ ...prev, [c.id]: !isExpanded }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{c.item_code}</td>
                          <td style={{ fontWeight: '600' }}>{c.description}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{c.value.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{c.totalInternalValue.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{c.executedValue.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{c.progressPercent.toFixed(1)}%</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>{c.totalClaimable.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{c.prevClaimed.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', backgroundColor: c.currentClaim > 0 ? '#f0fdf4' : 'inherit' }}>
                            {canEditBOQ ? (
                              <input
                                type="number"
                                step="any"
                                value={editedClaims[c.id] ?? Number(c.currentClaim.toFixed(3))}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  setEditedClaims(prev => ({ ...prev, [c.id]: val }));
                                }}
                                className="form-control"
                                style={{
                                  width: '110px',
                                  textAlign: 'right',
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.85rem',
                                  display: 'inline-block',
                                  border: '1px solid var(--border-color)',
                                  fontWeight: '700',
                                  color: 'var(--primary)'
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.85rem' }}>
                                {(editedClaims[c.id] ?? c.currentClaim).toFixed(3)}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '600' }}>{c.balanceAmount.toFixed(3)}</td>
                        </tr>

                        {/* Collapsible detail rows for internal items */}
                        {isExpanded && c.mappedInternals.map((internal) => {
                          let internalTotal = internal.approved_qty * internal.unit_rate;
                          let internalExecuted = db.getBOQExecutedValue(internal.id, claimDate);

                          if (internal.is_manpower_cost) {
                            const links = db.getManpowerLinks(internal.id);
                            const totalWeight = links.reduce((sum, l) => sum + (l.allocation_weight || 0), 0);
                            const link = links.find(l => l.client_boq_item_id === c.id);
                            if (link && totalWeight > 0) {
                              const weight = link.allocation_weight || 0;
                              internalTotal = internalTotal * (weight / totalWeight);
                              const progressPercent = db.getClientBOQProgressPercent(c.id, claimDate);
                              internalExecuted = internalTotal * (progressPercent / 100);
                            } else {
                              internalTotal = 0;
                              internalExecuted = 0;
                            }
                          }

                          return (
                            <tr key={internal.id} style={{ backgroundColor: '#f8fafc', fontSize: '0.8rem' }}>
                              <td></td>
                              <td style={{ color: 'var(--text-muted)' }}>↳ {internal.item_code}</td>
                              <td colSpan={2} style={{ color: 'var(--text-muted)' }}>{internal.description}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{internalTotal.toFixed(3)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{internalExecuted.toFixed(3)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {internalTotal > 0
                                  ? `${((internalExecuted / internalTotal) * 100).toFixed(1)}%`
                                  : '0%'}
                              </td>
                              <td colSpan={4}></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Historical Claims History */}
          <div className="page-title-group" style={{ marginBottom: '1rem' }}>
            <h2>Claim Logs & History</h2>
            <p>List of recorded client claims submitted for the project</p>
          </div>

          <div className="table-container">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Claim Date</th>
                  <th style={{ width: '25%' }}>Logged At</th>
                  <th style={{ width: '30%', textAlign: 'right' }}>Total Claimed Value (OMR)</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historicalClaims.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No claims logged yet for this project.
                    </td>
                  </tr>
                ) : (
                  historicalClaims.map((claim) => {
                    const claimLines = db.getClientClaimLines(claim.id);
                    const totalClaimed = claimLines.reduce((sum, l) => sum + l.claim_amount, 0);
                    return (
                      <tr key={claim.id}>
                        <td style={{ fontWeight: '700' }}>📅 {claim.claim_date}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(claim.created_at).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                          OMR {totalClaimed.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {canEditBOQ ? (
                            <button
                              onClick={() => handleDeleteClaim(claim.id)}
                              className="btn btn-outline"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.72rem', height: 'auto', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                            >
                              🗑️ Delete
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>👁 View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL: ADD / EDIT INTERNAL BOQ ITEM */}
      {showModal && (
        <div className="overlay">
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h2 className="modal-title">{editingId ? 'Edit BOQ Line Item' : 'Add BOQ Line Item'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {/* Left: Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Section / Scope of Work</label>
                      {existingSections.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsNewSection(!isNewSection)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          {isNewSection ? 'Select Existing' : 'Create New Section'}
                        </button>
                      )}
                    </div>
                    {isNewSection || existingSections.length === 0 ? (
                      <input
                        type="text"
                        name="section"
                        value={formData.section}
                        onChange={handleInputChange}
                        className="form-control"
                        placeholder="e.g. Civil Works, Landscaping, Irrigation"
                        required
                      />
                    ) : (
                      <select
                        name="section"
                        value={formData.section}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      >
                        <option value="">-- Choose Scope/Section --</option>
                        {existingSections.map((sec, idx) => (
                          <option key={idx} value={sec}>{sec}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* SUB SECTION FIELD */}
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Sub Section</label>
                      {existingSubSections.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsNewSubSection(!isNewSubSection)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          {isNewSubSection ? 'Select Existing' : 'Create New Sub Section'}
                        </button>
                      )}
                    </div>
                    {isNewSubSection || existingSubSections.length === 0 ? (
                      <input
                        type="text"
                        name="sub_section"
                        value={formData.sub_section}
                        onChange={handleInputChange}
                        className="form-control"
                        placeholder="e.g. Excavation, Piping, Ground Works"
                        required
                      />
                    ) : (
                      <select
                        name="sub_section"
                        value={formData.sub_section}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      >
                        <option value="">-- Choose Sub Section --</option>
                        {existingSubSections.map((sub, idx) => (
                          <option key={idx} value={sub}>{sub}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>Item Code</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={autoCode}
                            onChange={(e) => handleAutoCodeToggle(e.target.checked)}
                          />
                          Auto-generate
                        </label>
                      </div>
                      <input
                        type="text"
                        name="item_code"
                        value={formData.item_code}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                        disabled={autoCode}
                        placeholder="e.g. BOQ-1.1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit of Measure</label>
                      <input
                        type="text"
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                        placeholder="e.g. SQM, CUM, NOS, TON"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Description (Search & Select)</label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      onFocus={() => {
                        if (formData.description.trim().length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      className="form-control"
                      required
                      placeholder="Type to search similar items..."
                      autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <ul style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 1000,
                        maxHeight: '150px',
                        overflowY: 'auto',
                        padding: 0,
                        margin: 0,
                        listStyle: 'none'
                      }}>
                        {suggestions.map((sug, idx) => (
                          <li
                            key={idx}
                            onClick={() => handleSelectSuggestion(sug)}
                            style={{
                              padding: '0.4rem 0.6rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              fontSize: '0.8rem',
                              backgroundColor: '#fff'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                          >
                            <strong>{sug.item_code}</strong>: {sug.description} <span style={{ color: 'var(--text-muted)' }}>({sug.unit} @ OMR {sug.unit_rate})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* IS MANPOWER COST CHECKBOX */}
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                    <input
                      type="checkbox"
                      id="is_manpower_cost"
                      name="is_manpower_cost"
                      checked={formData.is_manpower_cost || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          is_manpower_cost: checked,
                          client_boq_item_id: checked ? '' : prev.client_boq_item_id,
                          client_boq_section: checked ? '' : prev.client_boq_section,
                          client_boq_sub_section: checked ? '' : prev.client_boq_sub_section
                        }));
                      }}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <label htmlFor="is_manpower_cost" style={{ cursor: 'pointer', fontWeight: '600', marginBottom: 0 }}>
                      Is Manpower Cost Item (Link to Multiple Client BOQ Items)
                    </label>
                  </div>

                  {formData.is_manpower_cost ? (
                    <div className="form-group" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', background: '#f8fafc', marginBottom: '1rem' }}>
                      <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                        Link to Client BOQ Items (Allocated proportionally based on Client item values)
                      </label>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid #cbd5e1', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: '#fff' }}>
                        {clientItems.length === 0 ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No Client BOQ items found. Add them first.</span>
                        ) : (
                          (() => {
                            const totalInternalValue = (formData.approved_qty || 0) * (formData.unit_rate || 0);
                            const totalClientValue = clientItems
                              .filter(cli => selectedClientBOQIds.includes(cli.id))
                              .reduce((sum, cli) => sum + cli.value, 0);

                            return clientItems.map(cli => {
                              const isChecked = selectedClientBOQIds.includes(cli.id);

                              let allocatedPercent = 0;
                              let allocatedValue = 0;
                              if (isChecked && totalClientValue > 0) {
                                allocatedPercent = (cli.value / totalClientValue) * 100;
                                allocatedValue = totalInternalValue * (cli.value / totalClientValue);
                              }

                              return (
                                <div key={cli.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0.5rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0, flex: 1 }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedClientBOQIds(prev => prev.filter(id => id !== cli.id));
                                        } else {
                                          setSelectedClientBOQIds(prev => [...prev, cli.id]);
                                        }
                                      }}
                                      style={{ width: 'auto', cursor: 'pointer' }}
                                    />
                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '380px' }} title={`${cli.item_code} - ${cli.description}`}>
                                      <strong>{cli.item_code}</strong> - {cli.description} (Value: OMR {cli.value.toFixed(2)})
                                    </span>
                                  </label>

                                  {isChecked && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: '600', minWidth: '125px', textAlign: 'right' }}>
                                        ({allocatedPercent.toFixed(1)}% = OMR {allocatedValue.toFixed(2)})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  ) : (
                    /* CLIENT BOQ MAPPING DROPDOWN */
                    <div className="form-group" style={{ position: 'relative' }}>
                      <label className="form-label">Map to Client BOQ Target (Item, Section, or Sub-section)</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="🔍 Type to search client item, section or sub-section..."
                          value={mappingSearchText}
                          onFocus={() => setShowMappingDropdown(true)}
                          onChange={(e) => {
                            const txt = e.target.value;
                            setMappingSearchText(txt);
                            setShowMappingDropdown(true);
                            if (!txt) {
                              setFormData(prev => ({ ...prev, client_boq_item_id: '', client_boq_section: '', client_boq_sub_section: '' }));
                            }
                          }}
                          className="form-control"
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '6px',
                            padding: '0.375rem 2.2rem 0.375rem 0.75rem',
                            fontSize: '0.9rem',
                            color: 'var(--text-main)'
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMappingDropdown(!showMappingDropdown);
                          }}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            padding: 0
                          }}
                        >
                          {showMappingDropdown ? '▲' : '▼'}
                        </button>
                      </div>

                      {showMappingDropdown && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '6px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            zIndex: 50,
                            marginTop: '0.25rem',
                            padding: '0.5rem',
                            maxHeight: '300px',
                            overflowY: 'auto'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {/* Unmapped option */}
                            <div
                              onClick={() => {
                                setFormData(prev => ({ ...prev, client_boq_item_id: '', client_boq_section: '', client_boq_sub_section: '' }));
                                setMappingSearchText('');
                                setShowMappingDropdown(false);
                              }}
                              style={{
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                color: 'var(--text-muted)',
                                backgroundColor: (!formData.client_boq_item_id && !formData.client_boq_section && !formData.client_boq_sub_section) ? '#f1f5f9' : 'transparent'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = (!formData.client_boq_item_id && !formData.client_boq_section && !formData.client_boq_sub_section) ? '#f1f5f9' : 'transparent'}
                            >
                              -- Do Not Map / Unmapped --
                            </div>

                            {/* Sections */}
                            {(() => {
                              const filterQuery = (mappingSearchText === getMappingLabel()) ? '' : mappingSearchText;
                              const sections = Array.from(new Set(clientItems.map(cli => cli.section || 'General').filter(Boolean)))
                                .filter(sec => sec.toLowerCase().includes(filterQuery.toLowerCase()));

                              if (sections.length === 0) return null;
                              return (
                                <>
                                  <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                                    📂 Headers (Sections)
                                  </div>
                                  {sections.map(sec => {
                                    const isSelected = formData.client_boq_section === sec && !formData.client_boq_sub_section && !formData.client_boq_item_id;
                                    return (
                                      <div
                                        key={sec}
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, client_boq_item_id: '', client_boq_section: sec, client_boq_sub_section: '' }));
                                          setMappingSearchText(`Header: ${sec}`);
                                          setShowMappingDropdown(false);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          fontSize: '0.82rem',
                                          color: 'var(--secondary-hover)',
                                          fontWeight: '600',
                                          backgroundColor: isSelected ? '#e0f2fe' : 'transparent'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = isSelected ? '#e0f2fe' : 'transparent'}
                                      >
                                        📁 Header: {sec}
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()}

                            {/* Sub-sections */}
                            {(() => {
                              const pairs: { section: string; sub_section: string }[] = [];
                              const seen = new Set<string>();
                              clientItems.forEach(cli => {
                                const sec = cli.section || 'General';
                                const subSec = cli.sub_section || 'General';
                                const key = `${sec}::${subSec}`;
                                if (!seen.has(key)) {
                                  seen.add(key);
                                  pairs.push({ section: sec, sub_section: subSec });
                                }
                              });

                              const filterQuery = (mappingSearchText === getMappingLabel()) ? '' : mappingSearchText;
                              const filteredPairs = pairs.filter(p => `${p.section} ${p.sub_section}`.toLowerCase().includes(filterQuery.toLowerCase()));
                              if (filteredPairs.length === 0) return null;

                              return (
                                <>
                                  <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                                    📂 Sub-sections
                                  </div>
                                  {filteredPairs.map(p => {
                                    const isSelected = formData.client_boq_section === p.section && formData.client_boq_sub_section === p.sub_section && !formData.client_boq_item_id;
                                    return (
                                      <div
                                        key={`${p.section}::${p.sub_section}`}
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, client_boq_item_id: '', client_boq_section: p.section, client_boq_sub_section: p.sub_section }));
                                          setMappingSearchText(`Sub-section: ${p.section} > ${p.sub_section}`);
                                          setShowMappingDropdown(false);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          fontSize: '0.82rem',
                                          color: 'var(--secondary-hover)',
                                          fontWeight: '600',
                                          backgroundColor: isSelected ? '#e0f2fe' : 'transparent'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = isSelected ? '#e0f2fe' : 'transparent'}
                                      >
                                        📁 Sub-section: {p.section} &gt; {p.sub_section}
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()}

                            {/* Individual Items */}
                            {(() => {
                              const filterQuery = (mappingSearchText === getMappingLabel()) ? '' : mappingSearchText;
                              const filteredItems = clientItems.filter(c =>
                                c.item_code.toLowerCase().includes(filterQuery.toLowerCase()) ||
                                c.description.toLowerCase().includes(filterQuery.toLowerCase())
                              );

                              if (filteredItems.length === 0) return null;

                              return (
                                <>
                                  <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                                    📋 Individual Items
                                  </div>
                                  {filteredItems.map(c => {
                                    const isSelected = formData.client_boq_item_id === c.id;
                                    return (
                                      <div
                                        key={c.id}
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, client_boq_item_id: c.id, client_boq_section: '', client_boq_sub_section: '' }));
                                          setMappingSearchText(`Item: ${c.item_code} - ${c.description}`);
                                          setShowMappingDropdown(false);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          fontSize: '0.82rem',
                                          color: 'var(--text-main)',
                                          backgroundColor: isSelected ? '#e0f2fe' : 'transparent'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = isSelected ? '#e0f2fe' : 'transparent'}
                                      >
                                        Item: {c.item_code} - {c.description} (Value: OMR {c.value.toFixed(3)})
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Planned Qty</label>
                      <input
                        type="number"
                        step="any"
                        name="planned_qty"
                        value={formData.planned_qty || ''}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Approved Qty</label>
                      <input
                        type="number"
                        step="any"
                        name="approved_qty"
                        value={formData.approved_qty || ''}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit Cost Rate (OMR)</label>
                      <input
                        type="number"
                        step="any"
                        name="unit_rate"
                        value={formData.unit_rate || ''}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">VAT Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="vat_rate"
                      value={formData.vat_rate}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                  <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Add Item'}</button>
                </div>
              </form>

              {/* Right: Price Reference */}
              <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem', overflowY: 'auto', maxHeight: '100%' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  💰 Cross-Project Price Reference
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Showing purchase history for similar items across all projects to help set the rate.
                </p>

                {(() => {
                  const history = db.getSimilarPurchaseHistory(formData.description);
                  if (history.length === 0) {
                    return (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        backgroundColor: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-color)',
                        fontSize: '0.85rem'
                      }}>
                        No historical purchases found for "{formData.description || '...'}" yet. Type another term to search.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                      {history.map((record, idx) => (
                        <div key={idx} style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--secondary-light)',
                          border: '1px solid #ccfbf1',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem',
                          transition: 'border-color 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--secondary-hover)', fontSize: '0.95rem' }}>
                              OMR {record.price.toFixed(3)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, unit_rate: record.price }));
                              }}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                            >
                              Apply Price
                            </button>
                          </div>
                          <div style={{ fontWeight: '500', color: 'var(--text-color)' }}>{record.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                            <div>🏢 Project: <strong>{record.projectName}</strong></div>
                            <div>🤝 Supplier: {record.supplierName}</div>
                            <div>📄 PO: {record.poNumber} | 📅 Date: {record.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CLIENT BOQ ITEM */}
      {showClientModal && (
        <div className="overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingClientId ? 'Edit Client BOQ Item' : 'Add Client BOQ Item'}</h2>
              <button className="close-btn" onClick={() => setShowClientModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleClientSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Main Section / Category</label>
                <input
                  type="text"
                  name="section"
                  value={clientFormData.section}
                  onChange={handleClientInputChange}
                  className="form-control"
                  list="client-sections-list"
                  placeholder="e.g. Civil Works, Irrigation, Landscaping"
                  required
                />
                <datalist id="client-sections-list">
                  {existingClientSections.map((sec, idx) => (
                    <option key={idx} value={sec} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Sub Section</label>
                <input
                  type="text"
                  name="sub_section"
                  value={clientFormData.sub_section}
                  onChange={handleClientInputChange}
                  className="form-control"
                  list="client-sub-sections-list"
                  placeholder="e.g. Excavation, Piping, Ground Works"
                  required
                />
                <datalist id="client-sub-sections-list">
                  {existingClientSubSections.map((sub, idx) => (
                    <option key={idx} value={sub} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Client Item Code</label>
                <input
                  type="text"
                  name="item_code"
                  value={clientFormData.item_code}
                  onChange={handleClientInputChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Description / Scope of Work</label>
                <input
                  type="text"
                  name="description"
                  value={clientFormData.description}
                  onChange={handleClientInputChange}
                  className="form-control"
                  placeholder="e.g. Landscaping Works"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input
                    type="text"
                    name="unit"
                    value={clientFormData.unit}
                    onChange={handleClientInputChange}
                    className="form-control"
                    placeholder="e.g. LS, SQM, NOS"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    name="qty"
                    value={clientFormData.qty || ''}
                    onChange={handleClientInputChange}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit Rate (OMR)</label>
                  <input
                    type="number"
                    step="any"
                    name="unit_rate"
                    value={clientFormData.unit_rate || ''}
                    onChange={handleClientInputChange}
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Subtotal Contract Value (OMR)</label>
                  <input
                    type="number"
                    step="any"
                    name="value"
                    value={clientFormData.value || ''}
                    onChange={handleClientInputChange}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowClientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingClientId ? 'Save Changes' : 'Create Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT PREVIEW MODAL */}
      {showImportModal && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm BOQ CSV Import</h2>
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
                    Successfully parsed <strong>{importPreview.length}</strong> items. Preview the items below before confirming:
                  </p>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Item Code</th>
                          <th>Description</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Planned Qty</th>
                          <th style={{ textAlign: 'right' }}>Approved Qty</th>
                          <th style={{ textAlign: 'right' }}>Unit Rate</th>
                          <th style={{ textAlign: 'right' }}>VAT Rate (%)</th>
                          <th style={{ textAlign: 'right' }}>Mapped Client BOQ</th>
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
                            <td style={{ fontWeight: '600' }}>{item.item_code}</td>
                            <td>{item.description}</td>
                            <td><span className="badge badge-draft">{item.unit}</span></td>
                            <td style={{ textAlign: 'right' }}>{item.planned_qty}</td>
                            <td style={{ textAlign: 'right' }}>{item.approved_qty}</td>
                            <td style={{ textAlign: 'right' }}>{item.unit_rate.toFixed(3)}</td>
                            <td style={{ textAlign: 'right' }}>{item.vat_rate}%</td>
                            <td style={{ textAlign: 'right', fontWeight: '500', color: item.client_boq_item_id ? 'var(--success)' : 'var(--text-muted)' }}>
                              {item.client_item_code || 'Unmapped'}
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
                Confirm & Import {importPreview.length} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL CLAIM REPORT PREVIEW MODAL */}
      {showReportPreview && (
        <div className="overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
            <style>{`
              @media print {
                @page {
                  margin: 0;
                }
                body {
                  margin: 1.8cm 0.6cm 0.6cm 0.6cm;
                }
                /* Hide top level sidebar/navbar layout elements */
                header, nav, footer, aside, .sidebar, .navbar, .global-header, .app-sidebar, .app-header {
                  display: none !important;
                }
                /* Hide everything in page content except overlay */
                .boq-page-wrapper > *:not(.overlay) {
                  display: none !important;
                }
                /* Format overlay for printable canvas layout */
                .overlay {
                  display: block !important;
                  position: relative !important;
                  background: transparent !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: auto !important;
                  height: auto !important;
                  backdrop-filter: none !important;
                  z-index: auto !important;
                }
                /* Hide modal header, footer action buttons from PDF output */
                .modal-header, .modal-footer, .print-hide {
                  display: none !important;
                  height: 0 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                body * {
                  visibility: hidden;
                }
                .print-report-area, .print-report-area * {
                  visibility: visible !important;
                }
                .print-report-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white !important;
                  padding: 8px !important;
                  box-shadow: none !important;
                  border: none !important;
                  color: black !important;
                }
              }
            `}</style>

            {(() => {
              // Oman standard calculations inside a local render block
              const totalContractValue = claimReportItems.reduce((sum, item) => sum + item.value, 0);
              const finalClientValue = customProjectClientValue !== '' ? parseFloat(customProjectClientValue) || 0 : totalContractValue;
              const grossCumulativeToDate = claimReportItems.reduce((sum, item) => sum + item.prevClaimed + item.currentClaim, 0);
              const currentClaimGross = claimReportItems.reduce((sum, item) => sum + item.currentClaim, 0);
              const prevClaimGross = claimReportItems.reduce((sum, item) => sum + item.prevClaimed, 0);

              // Cumulative Retention (capped at cap percentage of total contract value)
              const maxRetention = finalClientValue * (retentionCap / 100);
              const retentionCumulative = Math.min(grossCumulativeToDate * (retentionRate / 100), maxRetention);
              const retentionPrevious = Math.min(prevClaimGross * (retentionRate / 100), maxRetention);
              const retentionCurrent = retentionCumulative - retentionPrevious;

              // Cumulative Advance Recovery (proportional to overall completion percentage from contract value)
              const overallProgressPercent = finalClientValue > 0 ? (grossCumulativeToDate / finalClientValue) * 100 : 0;
              const prevOverallProgressPercent = finalClientValue > 0 ? (prevClaimGross / finalClientValue) * 100 : 0;
              const advanceRecoveryCumulative = Math.min(advanceReceived * (overallProgressPercent / 100), advanceReceived);
              const advanceRecoveryPrevious = Math.min(advanceReceived * (prevOverallProgressPercent / 100), advanceReceived);
              const advanceRecoveryCurrent = advanceRecoveryCumulative - advanceRecoveryPrevious;

              // Net Cumulative (incorporating additions and deductions)
              const totalAdditions = additionItems.reduce((sum, item) => sum + item.value, 0);
              const totalDeductions = deductionItems.reduce((sum, item) => sum + item.value, 0);
              const netCumulativeToDate = grossCumulativeToDate + totalAdditions - totalDeductions - retentionCumulative - advanceRecoveryCumulative;

              // Previous Net Payments Certified (calculated dynamically or overridden)
              const calculatedPreviousNet = prevClaimGross - retentionPrevious - advanceRecoveryPrevious;
              const actualPreviousNet = customPreviousPayments !== '' ? parseFloat(customPreviousPayments) || 0 : calculatedPreviousNet;

              // Net Amount Due
              const netAmountDue = netCumulativeToDate - actualPreviousNet;

              // VAT (normally 5% in Oman)
              const vatAmount = netAmountDue * (activeProject.vat_rate / 100);

              // Total Certified Amount Payable
              const totalCertifiedAmountPayable = netAmountDue + vatAmount;

              return (
                <>
                  <div className="modal-header print-hide" style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <h2 className="modal-title">📄 Project Invoice & Claim Preview (Oman Standard)</h2>
                    <button className="close-btn" onClick={() => setShowReportPreview(false)}>&times;</button>
                  </div>

                  {/* Print-hide Configuration Row */}
                  <div className="print-hide" style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      Invoice Settings (Oman Standard):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Retention Rate (%)</label>
                        <input
                          type="number"
                          value={retentionRate}
                          onChange={e => setRetentionRate(parseFloat(e.target.value) || 0)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Retention Cap (% of Contract)</label>
                        <input
                          type="number"
                          value={retentionCap}
                          onChange={e => setRetentionCap(parseFloat(e.target.value) || 0)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Advance Received (OMR)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={advanceReceived.toFixed(3)}
                          onChange={e => setAdvanceReceived(parseFloat(e.target.value) || 0)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Advance Recovery Rate (%)</label>
                        <input
                          type="text"
                          readOnly
                          value={`${overallProgressPercent.toFixed(1)}% (Based on overall progress)`}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'not-allowed' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Invoice Type / Stage</label>
                        <select
                          value={invoiceClassification}
                          onChange={e => setInvoiceClassification(e.target.value as any)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                        >
                          <option value="interim">Interim Invoice (Auto numbered)</option>
                          <option value="pre_final">Pre-Final Invoice</option>
                          <option value="final">Final Invoice</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Prev Payments Override (OMR)</label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder={`Default (${calculatedPreviousNet.toFixed(3)})`}
                          value={customPreviousPayments}
                          onChange={e => setCustomPreviousPayments(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Project Order Number</label>
                        <input
                          type="text"
                          placeholder="e.g. PO-10293"
                          value={projectOrderNumber}
                          onChange={e => setProjectOrderNumber(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Project Client Value (OMR)</label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder={`Default (${totalContractValue.toFixed(3)})`}
                          value={customProjectClientValue}
                          onChange={e => setCustomProjectClientValue(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>Client Name & Address Override</label>
                        <textarea
                          placeholder={`Default (${activeProject.client})`}
                          value={customClientNameAddress}
                          onChange={e => setCustomClientNameAddress(e.target.value)}
                          className="form-control"
                          rows={2}
                          style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', resize: 'vertical' }}
                        />
                      </div>
                    </div>

                    {/* Additions and Deductions Config Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                      {/* Additions list */}
                      <div>
                        <div style={{ fontWeight: '600', color: '#10b981', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>➕ Addition Items:</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setAdditionItems(prev => [...prev, { id: Math.random().toString(), name: '', value: 0 }])}
                          >
                            + Add Item
                          </button>
                        </div>
                        {additionItems.map((item, idx) => (
                          <div key={item.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="e.g. Variation Order 01"
                              value={item.name}
                              onChange={e => {
                                const newItems = [...additionItems];
                                newItems[idx].name = e.target.value;
                                setAdditionItems(newItems);
                              }}
                              className="form-control"
                              style={{ flex: 2, padding: '0.25rem 0.4rem', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            />
                            <input
                              type="number"
                              step="0.001"
                              placeholder="Value"
                              value={item.value || ''}
                              onChange={e => {
                                const newItems = [...additionItems];
                                newItems[idx].value = parseFloat(e.target.value) || 0;
                                setAdditionItems(newItems);
                              }}
                              className="form-control"
                              style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', textAlign: 'right' }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', lineHeight: 1 }}
                              onClick={() => setAdditionItems(prev => prev.filter(i => i.id !== item.id))}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Deductions list */}
                      <div>
                        <div style={{ fontWeight: '600', color: '#ef4444', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>➖ Deduction Items:</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setDeductionItems(prev => [...prev, { id: Math.random().toString(), name: '', value: 0 }])}
                          >
                            + Add Item
                          </button>
                        </div>
                        {deductionItems.map((item, idx) => (
                          <div key={item.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="e.g. Fuel Deduction"
                              value={item.name}
                              onChange={e => {
                                const newItems = [...deductionItems];
                                newItems[idx].name = e.target.value;
                                setDeductionItems(newItems);
                              }}
                              className="form-control"
                              style={{ flex: 2, padding: '0.25rem 0.4rem', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            />
                            <input
                              type="number"
                              step="0.001"
                              placeholder="Value"
                              value={item.value || ''}
                              onChange={e => {
                                const newItems = [...deductionItems];
                                newItems[idx].value = parseFloat(e.target.value) || 0;
                                setDeductionItems(newItems);
                              }}
                              className="form-control"
                              style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', textAlign: 'right' }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', lineHeight: 1 }}
                              onClick={() => setDeductionItems(prev => prev.filter(i => i.id !== item.id))}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Printable Area */}
                  <div className="print-report-area" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', fontFamily: 'Arial, sans-serif' }}>
                    {/* Letterhead */}
                    {(() => {
                      const company = db.getCompanyDetails();
                      return (
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #1e293b', paddingBottom: '1rem' }}>
                          <div style={{ textAlign: 'center' }}>
                            <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.6rem', fontWeight: 'bold', color: '#1e293b', letterSpacing: '0.5px' }}>
                              {company.name}
                            </h1>
                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.82rem', color: '#64748b', fontWeight: '500' }}>
                              {company.address}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                              <strong>VAT No:</strong> {company.vat_number} | <strong>CR No:</strong> {company.cr_number}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Title */}
                    {(() => {
                      const autoInvoiceNo = historicalClaims.length + 1;
                      let displayTitle = `INTERIM INVOICE - ${autoInvoiceNo}`;
                      if (invoiceClassification === 'pre_final') {
                        displayTitle = 'PRE-FINAL INVOICE';
                      } else if (invoiceClassification === 'final') {
                        displayTitle = 'FINAL INVOICE';
                      }
                      return (
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', textDecoration: 'underline', color: '#0f172a' }}>
                            {displayTitle}
                          </h2>
                        </div>
                      );
                    })()}

                    {/* Metadata details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      <div style={{ border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: '4px', color: '#0f172a' }}>
                        <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#475569' }}>PROJECT DETAILS</div>
                        <div><strong>Project Name:</strong> {activeProject.name}</div>
                        <div><strong>Site Location:</strong> {activeProject.site_location || 'Muscat, Oman'}</div>
                        <div><strong>Claim Date:</strong> {claimDate}</div>
                        <div><strong>Project Client Value:</strong> OMR {finalClientValue.toLocaleString('en-US', { minimumFractionDigits: 3 })}</div>
                        {projectOrderNumber && (
                          <div><strong>Project Order Number:</strong> {projectOrderNumber}</div>
                        )}
                      </div>
                      <div style={{ border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: '4px', color: '#0f172a' }}>
                        <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#475569' }}>TO</div>
                        <div style={{ whiteSpace: 'pre-line' }}><strong>Client Name and Address:</strong><br />{customClientNameAddress !== '' ? customClientNameAddress : (activeProject.client + (activeProject.site_location ? `\n${activeProject.site_location}` : ''))}</div>
                      </div>
                    </div>


                    {/* Oman Standard Detailed Certification Statement */}
                    <div style={{ marginTop: '1.5rem', marginBottom: '2rem', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', color: '#0f172a' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                        STATEMENT
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '500' }}>1. Valuation of Works Done</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 'bold', width: '25%' }}>
                              OMR {grossCumulativeToDate.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>

                          {/* Addition items list */}
                          {additionItems.map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#16a34a', paddingLeft: '1.5rem' }}>
                                Add: {item.name || `Addition Item ${idx + 1}`}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#16a34a', fontWeight: '500', width: '25%' }}>
                                + OMR {item.value.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                          ))}

                          {/* Deduction items list */}
                          {deductionItems.map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.5rem 0.75rem', color: '#dc2626', paddingLeft: '1.5rem' }}>
                                Less: {item.name || `Deduction Item ${idx + 1}`}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#dc2626', fontWeight: '500', width: '25%' }}>
                                - OMR {item.value.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                              </td>
                            </tr>
                          ))}

                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>
                              2. Less: Retention Deduction ({retentionRate}%)
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#dc2626', width: '25%' }}>
                              - OMR {retentionCumulative.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>
                              Advance Payment Received
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#0f172a', width: '25%' }}>
                              OMR {advanceReceived.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>
                              3. Less: Advance Payment Recovery
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#dc2626', width: '25%' }}>
                              - OMR {advanceRecoveryCumulative.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#1e3a8a' }}>
                              4. Net Valuation to Date (1 + Additions - Deductions - 2 - 3)
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#1e3a8a', width: '25%' }}>
                              OMR {netCumulativeToDate.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>
                              5. Less: Cumulative Net Payments Certified Previously
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#dc2626', width: '25%' }}>
                              - OMR {actualPreviousNet.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1.5px solid #cbd5e1', backgroundColor: '#f0fdf4' }}>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', fontSize: '0.88rem', color: '#15803d' }}>
                              6. Net Interim Amount Due (This Claim) (4 - 5)
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 'bold', fontSize: '0.88rem', color: '#15803d', width: '25%' }}>
                              OMR {netAmountDue.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>
                              7. Add: Value Added Tax (VAT) at {activeProject.vat_rate}%
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', width: '25%' }}>
                              OMR {vatAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', fontWeight: 'bold' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.92rem' }}>
                              8. TOTAL INTERIM PAYMENT CLAIMED (Net Due + VAT)
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.92rem', width: '25%' }}>
                              OMR {totalCertifiedAmountPayable.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f8fafc', color: '#334155' }}>
                        <strong>Amount in Words:</strong> <span style={{ fontStyle: 'italic', fontWeight: '600' }}>{convertOmrToWords(totalCertifiedAmountPayable)}</span>
                      </div>
                    </div>

                    {/* Signatures Section */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', marginTop: '4rem', color: '#0f172a' }}>
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '250px' }}>
                        <span><strong>For DIMAH AL RAEDAH TRADING SPC</strong></span>
                        <div style={{ borderTop: '1px solid #cbd5e1', width: '100%' }}>Authorized Signature & Date</div>
                      </div>
                    </div>
                  </div>

                  {/* Print action footer */}
                  <div className="modal-footer print-hide" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowReportPreview(false)}>Close Preview</button>
                    <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' }}>
                      🖨️ Print Invoice / Save PDF
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Bulk Link to Client BOQ Modal ── */}
      {showBulkLinkModal && (
        <div className="overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 1100 }} onClick={() => setShowBulkLinkModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '820px',
              width: '90%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🔗</span> Bulk Link Internal BOQ → Client BOQ
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Map multiple internal costing lines to a client-facing billing items in one action
                </p>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowBulkLinkModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ✕
              </button>
            </div>

            {/* Content Container */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {/* Global assign */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)',
                position: 'relative'
              }}>
                <label style={{ fontWeight: '700', color: '#166534', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>⚡</span> Bulk Assign All Selected Items
                </label>
                <div style={{ position: 'relative', width: '100%', maxWidth: '540px' }}>
                  {/* Search and Select Bar */}
                  <div
                    onClick={() => setShowBulkLinkDropdown(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'white',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '0.65rem 1rem',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      fontWeight: '500'
                    }}
                  >
                    <span style={{ color: bulkLinkGlobal === '__keep__' ? 'var(--text-muted)' : 'var(--text-main)' }}>
                      {bulkLinkGlobal === '__keep__' && '— Keep individual mappings chosen below —'}
                      {bulkLinkGlobal === '' && '✕ Unlink all (make unmapped)'}
                      {bulkLinkGlobal !== '__keep__' && bulkLinkGlobal !== '' && (() => {
                        if (bulkLinkGlobal.startsWith('subsection::')) {
                          const parts = bulkLinkGlobal.replace('subsection::', '').split('::');
                          return `📁 Sub-section: ${parts[0]} > ${parts[1]}`;
                        }
                        if (bulkLinkGlobal.startsWith('section::')) {
                          const sec = bulkLinkGlobal.replace('section::', '');
                          return `📁 Header: ${sec}`;
                        }
                        const cleanId = bulkLinkGlobal.startsWith('item::') ? bulkLinkGlobal.replace('item::', '') : bulkLinkGlobal;
                        const selected = clientItems.find(c => c.id === cleanId);
                        return selected ? `${selected.item_code} — ${selected.description}` : 'Selected target';
                      })()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#166534' }}>{showBulkLinkDropdown ? '▲' : '▼'}</span>
                  </div>

                  {showBulkLinkDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      zIndex: 10,
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      maxHeight: '260px',
                      overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="🔍 Search client header or description..."
                        value={bulkLinkSearchQuery}
                        onChange={e => setBulkLinkSearchQuery(e.target.value)}
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
                            setBulkLinkGlobal('__keep__');
                            setShowBulkLinkDropdown(false);
                            setBulkLinkSearchQuery('');
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            backgroundColor: bulkLinkGlobal === '__keep__' ? '#f1f5f9' : 'transparent',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            color: 'var(--text-muted)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = bulkLinkGlobal === '__keep__' ? '#f1f5f9' : 'transparent'}
                        >
                          — Keep individual mappings chosen below —
                        </div>
                        <div
                          onClick={() => {
                            setBulkLinkGlobal('');
                            setShowBulkLinkDropdown(false);
                            setBulkLinkSearchQuery('');
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            backgroundColor: bulkLinkGlobal === '' ? '#fee2e2' : 'transparent',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            color: 'var(--danger)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = bulkLinkGlobal === '' ? '#fee2e2' : 'transparent'}
                        >
                          ✕ Unlink all (make unmapped)
                        </div>

                        {/* Group: Headers */}
                        {Array.from(new Set(clientItems.map(cli => cli.section || 'General').filter(Boolean)))
                          .filter(sec => sec.toLowerCase().includes(bulkLinkSearchQuery.toLowerCase()))
                          .map(sec => {
                            const val = `section::${sec}`;
                            return (
                              <div
                                key={sec}
                                onClick={() => {
                                  setBulkLinkGlobal(val);
                                  setShowBulkLinkDropdown(false);
                                  setBulkLinkSearchQuery('');
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  backgroundColor: bulkLinkGlobal === val ? '#e0f2fe' : 'transparent',
                                  fontSize: '0.82rem',
                                  color: 'var(--secondary-hover)',
                                  fontWeight: '600',
                                  borderBottom: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = bulkLinkGlobal === val ? '#e0f2fe' : 'transparent'}
                              >
                                📁 Header: {sec}
                              </div>
                            );
                          })
                        }

                        {/* Group: Sub-sections */}
                        {(() => {
                          const pairs: { section: string; sub_section: string }[] = [];
                          const seen = new Set<string>();
                          clientItems.forEach(cli => {
                            const sec = cli.section || 'General';
                            const subSec = cli.sub_section || 'General';
                            const key = `${sec}::${subSec}`;
                            if (!seen.has(key)) {
                              seen.add(key);
                              pairs.push({ section: sec, sub_section: subSec });
                            }
                          });
                          return pairs
                            .filter(p => `${p.section} ${p.sub_section}`.toLowerCase().includes(bulkLinkSearchQuery.toLowerCase()))
                            .map(p => {
                              const val = `subsection::${p.section}::${p.sub_section}`;
                              return (
                                <div
                                  key={val}
                                  onClick={() => {
                                    setBulkLinkGlobal(val);
                                    setShowBulkLinkDropdown(false);
                                    setBulkLinkSearchQuery('');
                                  }}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    backgroundColor: bulkLinkGlobal === val ? '#e0f2fe' : 'transparent',
                                    fontSize: '0.82rem',
                                    color: 'var(--secondary-hover)',
                                    fontWeight: '600',
                                    borderBottom: '1px solid #f1f5f9'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = bulkLinkGlobal === val ? '#e0f2fe' : 'transparent'}
                                >
                                  📁 Sub-section: {p.section} &gt; {p.sub_section}
                                </div>
                              );
                            });
                        })()}

                        {/* Group: Items */}
                        {clientItems
                          .filter(c =>
                            c.item_code.toLowerCase().includes(bulkLinkSearchQuery.toLowerCase()) ||
                            c.description.toLowerCase().includes(bulkLinkSearchQuery.toLowerCase())
                          )
                          .map(c => {
                            const val = `item::${c.id}`;
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setBulkLinkGlobal(val);
                                  setShowBulkLinkDropdown(false);
                                  setBulkLinkSearchQuery('');
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  backgroundColor: bulkLinkGlobal === val ? '#e0f2fe' : 'transparent',
                                  fontSize: '0.82rem',
                                  color: 'var(--text-main)',
                                  borderBottom: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = bulkLinkGlobal === val ? '#e0f2fe' : 'transparent'}
                              >
                                <strong>{c.item_code}</strong> — {c.description} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(OMR {c.value.toLocaleString('en-US', { minimumFractionDigits: 3 })})</span>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
                {bulkLinkGlobal !== '__keep__' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', color: '#b45309', fontSize: '0.78rem', fontWeight: '500' }}>
                    <span>⚠️</span> Overriding per-row mappings. Manual dropdowns below are disabled.
                  </div>
                )}
              </div>

              {/* Per-row table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                  Selected Internal Items ({Object.keys(bulkLinkMap).length})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Assigning individually:
                </span>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item Code</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description & Section</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '320px' }}>Target Client BOQ Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(bulkLinkMap).map(id => {
                      const boqItem = items.find((i: any) => i.id === id);
                      if (!boqItem) return null;
                      const isOverridden = bulkLinkGlobal !== '__keep__';
                      return (
                        <tr key={id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isOverridden ? '#fbfcfe' : 'transparent', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '0.8rem 1rem', fontWeight: '700', color: 'var(--primary-hover)', whiteSpace: 'nowrap' }}>
                            {boqItem.item_code}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontWeight: '500', color: 'var(--text-main)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={boqItem.description}>
                              {boqItem.description}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.8rem' }}>📁</span> {boqItem.section || 'General Works'}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <select
                              value={isOverridden ? (bulkLinkGlobal === '' ? '' : bulkLinkGlobal) : bulkLinkMap[id]}
                              onChange={e => setBulkLinkMap(prev => ({ ...prev, [id]: e.target.value }))}
                              className="form-control"
                              style={{
                                fontSize: '0.8rem',
                                padding: '0.45rem 0.75rem',
                                width: '100%',
                                opacity: isOverridden ? 0.65 : 1,
                                cursor: isOverridden ? 'not-allowed' : 'pointer',
                                backgroundColor: isOverridden ? '#f1f5f9' : 'white',
                                borderColor: isOverridden ? '#e2e8f0' : 'var(--border-color)'
                              }}
                              disabled={isOverridden}
                            >
                              <option value="">✕ Unlinked / No Mapping</option>

                              <optgroup label="📂 Client BOQ Configuration Headers (Sections)">
                                {Array.from(new Set(clientItems.map(cli => cli.section || 'General').filter(Boolean))).map((sec) => (
                                  <option key={sec} value={`section::${sec}`}>
                                    📁 Header: {sec}
                                  </option>
                                ))}
                              </optgroup>

                              <optgroup label="📂 Client BOQ Configuration Sub-sections">
                                {(() => {
                                  const pairs: { section: string; sub_section: string }[] = [];
                                  const seen = new Set<string>();
                                  clientItems.forEach(cli => {
                                    const sec = cli.section || 'General';
                                    const subSec = cli.sub_section || 'General';
                                    const key = `${sec}::${subSec}`;
                                    if (!seen.has(key)) {
                                      seen.add(key);
                                      pairs.push({ section: sec, sub_section: subSec });
                                    }
                                  });
                                  return pairs.map(p => (
                                    <option key={`${p.section}::${p.sub_section}`} value={`subsection::${p.section}::${p.sub_section}`}>
                                      📁 Sub-section: {p.section} &gt; {p.sub_section}
                                    </option>
                                  ));
                                })()}
                              </optgroup>

                              <optgroup label="📋 Client BOQ Individual Items">
                                {clientItems.map((cli) => (
                                  <option key={cli.id} value={`item::${cli.id}`}>
                                    Item: {cli.item_code} — {cli.description}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {clientItems.length === 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '1.25rem',
                  color: '#b45309',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                  <div>
                    <strong>No Client BOQ items exist yet.</strong> Please configure client billing items on the <strong>Work order BOQ</strong> tab first.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button
                className="btn btn-outline"
                style={{ padding: '0.55rem 1.25rem' }}
                onClick={() => setShowBulkLinkModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveBulkLink}
                disabled={clientItems.length === 0}
                style={{
                  padding: '0.55rem 1.5rem',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                💾 Save Mappings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Client BOQ CSV Import Preview Modal ── */}
      {showClientImportModal && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Client BOQ Import</h2>
              <button className="close-btn" onClick={() => {
                setShowClientImportModal(false);
                setClientImportPreview([]);
                setClientImportErrors([]);
              }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              {clientImportErrors.length > 0 && (
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
                    {clientImportErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {clientImportPreview.length > 0 ? (
                <div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Successfully parsed <strong>{clientImportPreview.length}</strong> items. Preview and confirm the client billing configuration below:
                  </p>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Client Item Code</th>
                          <th>Description / Scope</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Unit Rate</th>
                          <th style={{ textAlign: 'right' }}>Subtotal Value (OMR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientImportPreview.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              {item.has_conflict ? (
                                <select
                                  value={item.is_update ? 'update' : 'new'}
                                  onChange={(e) => {
                                    const mode = e.target.value;
                                    setClientImportPreview(prev => {
                                      const next = [...prev];
                                      next[idx] = {
                                        ...next[idx],
                                        is_update: mode === 'update',
                                        id: mode === 'update' ? item.existing_id : undefined
                                      };
                                      return next;
                                    });
                                  }}
                                  className="form-control"
                                  style={{
                                    padding: '0.15rem 0.35rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    height: 'auto',
                                    width: '120px',
                                    backgroundColor: item.is_update ? '#fef3c7' : '#dcfce7',
                                    color: item.is_update ? '#d97706' : '#15803d',
                                    borderColor: item.is_update ? '#fde68a' : '#bbf7d0',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="update" style={{ backgroundColor: 'white', color: 'var(--text-color)' }}>🔄 Update</option>
                                  <option value="new" style={{ backgroundColor: 'white', color: 'var(--text-color)' }}>➕ Save As New</option>
                                </select>
                              ) : (
                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>New</span>
                              )}
                            </td>
                            <td style={{ fontWeight: '700' }}>{item.item_code}</td>
                            <td>{item.description}</td>
                            <td><span className="badge badge-draft">{item.unit || 'LS'}</span></td>
                            <td style={{ textAlign: 'right' }}>{(item.qty ?? 1.000).toFixed(3)}</td>
                            <td style={{ textAlign: 'right' }}>{(item.unit_rate ?? 0).toFixed(3)}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600' }}>
                              OMR {item.value.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                clientImportErrors.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No valid rows found in the imported file.
                  </p>
                )
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowClientImportModal(false);
                  setClientImportPreview([]);
                  setClientImportErrors([]);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClientImportConfirm}
                className="btn btn-primary"
                disabled={clientImportPreview.length === 0}
              >
                Confirm & Import {clientImportPreview.length} Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Omani Rial number to words converter (3 decimal places / Baizas)
function convertOmrToWords(amount: number): string {
  if (isNaN(amount) || amount < 0) return 'Zero Rials';

  const rials = Math.floor(amount);
  const baizas = Math.round((amount - rials) * 1000);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const groups = ['', 'Thousand', 'Million', 'Billion'];

  function convertGroup(num: number): string {
    let result = '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;

    if (h > 0) {
      result += ones[h] + ' Hundred ';
    }
    if (t >= 2) {
      result += tens[t] + ' ';
      if (o > 0) result += ones[o] + ' ';
    } else if (t === 1 || (t === 0 && o > 0)) {
      const idx = t * 10 + o;
      result += ones[idx] + ' ';
    }
    return result.trim();
  }

  function convertNum(num: number): string {
    if (num === 0) return 'Zero';
    let result = '';
    let groupIdx = 0;
    let temp = num;

    while (temp > 0) {
      const groupVal = temp % 1000;
      if (groupVal > 0) {
        const groupStr = convertGroup(groupVal);
        result = groupStr + (groups[groupIdx] ? ' ' + groups[groupIdx] : '') + ' ' + result;
      }
      temp = Math.floor(temp / 1000);
      groupIdx++;
    }
    return result.trim();
  }

  const rialsStr = rials === 0 ? 'Zero Rials' : convertNum(rials) + (rials === 1 ? ' Rial Omani' : ' Rials Omani');
  const baizasStr = baizas > 0 ? ' and ' + convertNum(baizas) + (baizas === 1 ? ' Baiza' : ' Baizas') : '';

  return rialsStr + baizasStr + ' Only';
}
