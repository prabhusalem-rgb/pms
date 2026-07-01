// Oman PMS Database Adapter with Supabase Integration and localStorage fallback
// Supports 5% standard Oman VAT and Multi-Project Management
import { supabase } from './supabase';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};


export interface Project {
  id: string;
  name: string;
  client: string;
  consultant: string;
  site_location: string;
  currency: string;
  vat_rate: number; // in percent, e.g., 5.00
  cr_number: string;
  vat_number: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface BOQItem {
  id: string;
  project_id: string;
  item_code: string;
  description: string;
  section: string;
  sub_section?: string | null;
  unit: string;
  planned_qty: number;
  approved_qty: number;
  unit_rate: number;
  vat_rate: number;
  subtotal: number;
  client_boq_item_id?: string | null;
  client_boq_section?: string | null;
  created_at: string;
}

export interface ClientBOQItem {
  id: string;
  project_id: string;
  item_code: string;
  description: string;
  value: number;
  section?: string | null;
  unit?: string | null;
  qty?: number | null;
  created_at: string;
}

export interface ClientClaim {
  id: string;
  project_id: string;
  claim_date: string;
  created_at: string;
}

export interface ClientClaimLine {
  id: string;
  claim_id: string;
  client_boq_item_id: string;
  claim_amount: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: 'Material Supplier' | 'Subcontractor';
  contact_person: string;
  email: string;
  phone: string;
  cr_number: string;
  vat_number: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  project_id: string;
  supplier_id: string;
  description: string;
  status: 'draft' | 'issued' | 'partially_received' | 'closed';
  type: 'material' | 'subcontract';
  retention_percent: number;
  terms_and_conditions?: string;
  created_at: string;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  boq_item_id: string | null;
  description: string;
  qty: number;
  unit_rate: number;
  vat_rate: number;
  created_at: string;
}

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  po_id: string;
  project_id: string;
  received_date: string;
  received_by: string;
  delivery_note_number?: string;
  created_at: string;
}

export interface GRNLine {
  id: string;
  grn_id: string;
  po_line_id: string;
  qty_received: number;
  created_at: string;
}

export interface MaterialIssue {
  id: string;
  issue_number: string;
  project_id: string;
  issue_date: string;
  issued_to_location: string;
  issued_by: string;
  created_at: string;
}

export interface IssueLine {
  id: string;
  issue_id: string;
  boq_item_id: string;
  qty_issued: number;
  qty_wastage: number;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  role: 'Admin' | 'Purchase' | 'Site';
  password_hash: string;
  created_at: string;
}

export type AccessLevel = 'Full' | 'View' | 'None';
export type ModuleKey = 'dashboard' | 'projects' | 'boq' | 'procurement' | 'suppliers' | 'inventory' | 'reports' | 'users';

export interface PermissionMatrix {
  [module: string]: {
    Admin: AccessLevel;
    Purchase: AccessLevel;
    Site: AccessLevel;
  };
}

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  dashboard:   { Admin: 'Full', Purchase: 'None', Site: 'None' },
  projects:    { Admin: 'Full', Purchase: 'View', Site: 'View' },
  boq:         { Admin: 'Full', Purchase: 'View', Site: 'View' },
  procurement: { Admin: 'Full', Purchase: 'Full', Site: 'None' },
  suppliers:   { Admin: 'Full', Purchase: 'Full', Site: 'None' },
  inventory:   { Admin: 'Full', Purchase: 'None', Site: 'Full' },
  reports:     { Admin: 'Full', Purchase: 'View', Site: 'View' },
  users:       { Admin: 'Full', Purchase: 'None', Site: 'None' },
};

// Initial Mock Data to populate localStorage if empty
// Initial Mock Data to populate localStorage if empty
const INITIAL_PROJECTS: Project[] = [];
const INITIAL_BOQ: BOQItem[] = [];
const INITIAL_SUPPLIERS: Supplier[] = [];

// Helper functions for Database interactions (local storage wrapper with simple database sync APIs)
class DatabaseManager {
  private isClient = typeof window !== 'undefined';

  private trackDeletion(id: string): void {
    const deleted = this.get<string>('deleted_ids', []);
    if (!deleted.includes(id)) {
      deleted.push(id);
      this.save('deleted_ids', deleted);
    }
  }

  private getSyncedIds(): Set<string> {
    if (!this.isClient) return new Set();
    const stored = localStorage.getItem('pms_synced_ids');
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  }

  private saveSyncedIds(ids: Set<string>): void {
    if (this.isClient) {
      localStorage.setItem('pms_synced_ids', JSON.stringify(Array.from(ids)));
    }
  }

  private trackSyncedId(id: string): void {
    const ids = this.getSyncedIds();
    if (!ids.has(id)) {
      ids.add(id);
      this.saveSyncedIds(ids);
    }
  }

  private untrackSyncedId(id: string): void {
    const ids = this.getSyncedIds();
    if (ids.has(id)) {
      ids.delete(id);
      this.saveSyncedIds(ids);
    }
  }


  constructor() {
    if (this.isClient) {
      const cleared = localStorage.getItem('pms_demo_cleared_v2');
      if (!cleared) {
        localStorage.removeItem('pms_projects');
        localStorage.removeItem('pms_boq');
        localStorage.removeItem('pms_suppliers');
        localStorage.removeItem('pms_pos');
        localStorage.removeItem('pms_po_lines');
        localStorage.removeItem('pms_grns');
        localStorage.removeItem('pms_grn_lines');
        localStorage.removeItem('pms_material_issues');
        localStorage.removeItem('pms_issue_lines');
        localStorage.setItem('pms_demo_cleared_v2', 'true');
      }
      // Seed default admin user if no users exist
      const existingUsers = this.get<User>('users', []);
      if (existingUsers.length === 0) {
        const defaultAdmin: User = {
          id: 'admin-default',
          username: 'admin',
          role: 'Admin',
          password_hash: '2026',
          created_at: new Date().toISOString()
        };
        this.save('users', [defaultAdmin]);
      }
    }
  }

  private get<T>(key: string, initial: T[]): T[] {
    if (!this.isClient) return initial;
    const item = localStorage.getItem(`pms_${key}`);
    if (!item) {
      localStorage.setItem(`pms_${key}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(item);
  }

  private save<T>(key: string, data: T[]): void {
    if (this.isClient) {
      localStorage.setItem(`pms_${key}`, JSON.stringify(data));
    }
  }

  // --- Project CRUD ---
  getProjects(): Project[] {
    return this.get<Project>('projects', INITIAL_PROJECTS);
  }

  saveProject(project: Omit<Project, 'id' | 'created_at'> & { id?: string }): Project {
    const projects = this.getProjects();
    const existing = project.id ? projects.find(p => p.id === project.id) : null;
    const newProj: Project = {
      ...project,
      id: project.id || generateUUID(),
      created_at: existing ? existing.created_at : new Date().toISOString()
    };
    const index = projects.findIndex(p => p.id === newProj.id);
    if (index >= 0) {
      projects[index] = newProj;
    } else {
      projects.push(newProj);
    }
    this.save('projects', projects);
    
    // Track locally deleted ID immediately
    this.untrackSyncedId(newProj.id);

    if (supabase) {
      supabase.from('projects').upsert(newProj).then(({ error }) => {
        if (error) {
          console.error('Supabase saveProject error:', error);
        } else {
          this.trackSyncedId(newProj.id);
        }
      });
    }

    return newProj;
  }

  deleteProject(projectId: string): void {
    this.trackDeletion(projectId);
    this.untrackSyncedId(projectId);
    // Remove project
    const projects = this.getProjects();
    const updatedProjects = projects.filter(p => p.id !== projectId);
    this.save('projects', updatedProjects);

    // Cascading delete
    // 1. BOQ items
    const boqItems = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updatedBOQ = boqItems.filter(b => b.project_id !== projectId);
    this.save('boq', updatedBOQ);

    // 2. POs & PO Lines
    const pos = this.get<PurchaseOrder>('pos', []);
    const projectPOs = pos.filter(po => po.project_id === projectId);
    const projectPoIds = projectPOs.map(po => po.id);
    const remainingPOs = pos.filter(po => po.project_id !== projectId);
    this.save('pos', remainingPOs);

    const poLines = this.get<PurchaseOrderLine>('po_lines', []);
    const remainingPoLines = poLines.filter(pol => !projectPoIds.includes(pol.po_id));
    this.save('po_lines', remainingPoLines);

    // 3. GRNs & GRN Lines
    const grns = this.get<GoodsReceiptNote>('grns', []);
    const projectGRNs = grns.filter(grn => grn.project_id === projectId);
    const projectGrnIds = projectGRNs.map(grn => grn.id);
    const remainingGRNs = grns.filter(grn => grn.project_id !== projectId);
    this.save('grns', remainingGRNs);

    const grnLines = this.get<GRNLine>('grn_lines', []);
    const remainingGrnLines = grnLines.filter(grnl => !projectGrnIds.includes(grnl.grn_id));
    this.save('grn_lines', remainingGrnLines);

    // 4. Material Issues & Issue Lines
    const issues = this.get<MaterialIssue>('material_issues', []);
    const projectIssues = issues.filter(issue => issue.project_id === projectId);
    const projectIssueIds = projectIssues.map(issue => issue.id);
    const remainingIssues = issues.filter(issue => issue.project_id !== projectId);
    this.save('material_issues', remainingIssues);

    const issueLines = this.get<IssueLine>('issue_lines', []);
    const remainingIssueLines = issueLines.filter(il => !projectIssueIds.includes(il.issue_id));
    this.save('issue_lines', remainingIssueLines);

    if (supabase) {
      supabase.from('projects').delete().eq('id', projectId).then(({ error }) => {
        if (error) console.error('Supabase deleteProject error:', error);
      });
    }
  }

  // --- BOQ CRUD ---
  getBOQItems(projectId?: string): BOQItem[] {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    return projectId ? items.filter(item => item.project_id === projectId) : items;
  }

  saveBOQItem(item: Omit<BOQItem, 'id' | 'subtotal' | 'created_at'> & { id?: string }): BOQItem {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const newItem: BOQItem = {
      ...item,
      id: item.id || generateUUID(),
      section: item.section || 'General Works',
      sub_section: item.sub_section || 'General',
      client_boq_item_id: item.client_boq_item_id || null,
      client_boq_section: item.client_boq_section || null,
      subtotal: item.approved_qty * item.unit_rate,
      created_at: new Date().toISOString()
    };
    const index = items.findIndex(i => i.id === newItem.id);
    if (index >= 0) {
      items[index] = newItem;
    } else {
      items.push(newItem);
    }
    this.save('boq', items);

    this.untrackSyncedId(newItem.id);

    if (supabase) {
      const { subtotal, client_item_code, ...supabaseItem } = newItem as any;
      supabase.from('boq_items').upsert(supabaseItem).then(({ error }) => {
        if (error) {
          console.error('Supabase saveBOQItem error:', error);
          console.error('Error Code:', error.code);
          console.error('Error Message:', error.message);
          console.error('Error Details:', error.details);
          console.error('Error Hint:', error.hint);
        } else {
          this.trackSyncedId(newItem.id);
        }
      });
    }

    return newItem;
  }

  deleteBOQItem(itemId: string): void {
    this.trackDeletion(itemId);
    this.untrackSyncedId(itemId);
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updated = items.filter(i => i.id !== itemId);
    this.save('boq', updated);

    if (supabase) {
      supabase.from('boq_items').delete().eq('id', itemId).then(({ error }) => {
        if (error) console.error('Supabase deleteBOQItem error:', error);
      });
    }
  }

  /** Bulk-assign multiple internal BOQ items to a client BOQ item or a client section. */
  bulkLinkBOQItems(itemIds: string[], clientBOQItemId: string | null, clientBOQSection: string | null = null): void {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updatedItems: BOQItem[] = items.map(item => {
      if (!itemIds.includes(item.id)) return item;
      return { 
        ...item, 
        client_boq_item_id: clientBOQItemId, 
        client_boq_section: clientBOQSection 
      };
    });
    this.save('boq', updatedItems);

    itemIds.forEach(id => this.untrackSyncedId(id));

    if (supabase) {
      const toUpsert = updatedItems
        .filter(i => itemIds.includes(i.id))
        .map(i => ({
          id: i.id,
          project_id: i.project_id,
          item_code: i.item_code,
          description: i.description,
          unit: i.unit,
          planned_qty: i.planned_qty,
          approved_qty: i.approved_qty,
          unit_rate: i.unit_rate,
          vat_rate: i.vat_rate,
          section: i.section,
          sub_section: i.sub_section || null,
          client_boq_item_id: i.client_boq_item_id || null,
          client_boq_section: i.client_boq_section || null
        }));
      supabase.from('boq_items').upsert(toUpsert).then(({ error }) => {
        if (error) {
          console.error('Supabase bulkLinkBOQItems error:', error);
          console.error('Error Code:', error.code);
          console.error('Error Message:', error.message);
          console.error('Error Details:', error.details);
          console.error('Error Hint:', error.hint);
        } else {
          itemIds.forEach(id => this.trackSyncedId(id));
        }
      });
    }
  }

  // --- Client BOQ CRUD ---

  getClientBOQItems(projectId?: string): ClientBOQItem[] {
    const items = this.get<ClientBOQItem>('client_boq', []);
    return projectId ? items.filter(item => item.project_id === projectId) : items;
  }

  saveClientBOQItem(item: Omit<ClientBOQItem, 'id' | 'created_at'> & { id?: string }): ClientBOQItem {
    const items = this.get<ClientBOQItem>('client_boq', []);
    const newItem: ClientBOQItem = {
      ...item,
      id: item.id || generateUUID(),
      section: item.section || 'General',
      unit: item.unit || 'LS',
      qty: item.qty !== undefined && item.qty !== null ? item.qty : 1.000,
      created_at: new Date().toISOString()
    };
    const index = items.findIndex(i => i.id === newItem.id);
    if (index >= 0) {
      items[index] = newItem;
    } else {
      items.push(newItem);
    }
    this.save('client_boq', items);

    this.untrackSyncedId(newItem.id);

    if (supabase) {
      const dbPayload = {
        id: newItem.id,
        project_id: newItem.project_id,
        item_code: newItem.item_code,
        description: newItem.description,
        value: newItem.value ?? 0,
        section: newItem.section || null,
        unit: newItem.unit || null,
        qty: newItem.qty ?? null,
        created_at: newItem.created_at
      };
      supabase.from('client_boq_items').upsert(dbPayload).then(({ error }) => {
        if (error) {
          console.error('Supabase saveClientBOQItem error:', error);
        } else {
          this.trackSyncedId(newItem.id);
        }
      });
    }

    return newItem;
  }

  deleteClientBOQItem(id: string): void {
    this.trackDeletion(id);
    this.untrackSyncedId(id);
    const items = this.get<ClientBOQItem>('client_boq', []);
    const updated = items.filter(i => i.id !== id);
    this.save('client_boq', updated);

    const boqItems = this.get<BOQItem>('boq', []);
    let modified = false;
    const updatedBOQs = boqItems.map(item => {
      if (item.client_boq_item_id === id) {
        modified = true;
        const { client_boq_item_id, ...rest } = item;
        return rest as BOQItem;
      }
      return item;
    });
    if (modified) {
      this.save('boq', updatedBOQs);
    }

    if (supabase) {
      supabase.from('client_boq_items').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteClientBOQItem error:', error);
      });
    }
  }

  // --- Client Claims CRUD ---
  getClientClaims(projectId?: string): ClientClaim[] {
    const claims = this.get<ClientClaim>('client_claims', []);
    return projectId ? claims.filter(claim => claim.project_id === projectId) : claims;
  }

  getClientClaimLines(claimId?: string): ClientClaimLine[] {
    const lines = this.get<ClientClaimLine>('client_claim_lines', []);
    return claimId ? lines.filter(l => l.claim_id === claimId) : lines;
  }

  saveClientClaim(
    claim: Omit<ClientClaim, 'id' | 'created_at'> & { id?: string },
    lines: Omit<ClientClaimLine, 'id' | 'claim_id' | 'created_at'>[]
  ): ClientClaim {
    const claims = this.get<ClientClaim>('client_claims', []);
    const newClaim: ClientClaim = {
      ...claim,
      id: claim.id || generateUUID(),
      created_at: new Date().toISOString()
    };

    const index = claims.findIndex(c => c.id === newClaim.id);
    if (index >= 0) {
      claims[index] = newClaim;
    } else {
      claims.push(newClaim);
    }
    this.save('client_claims', claims);

    const allLines = this.get<ClientClaimLine>('client_claim_lines', []);
    const filteredLines = allLines.filter(l => l.claim_id !== newClaim.id);
    
    const newLines = lines.map(l => ({
      ...l,
      id: generateUUID(),
      claim_id: newClaim.id,
      created_at: new Date().toISOString()
    }));

    const updatedLines = [...filteredLines, ...newLines];
    this.save('client_claim_lines', updatedLines);

    this.untrackSyncedId(newClaim.id);
    newLines.forEach(line => this.untrackSyncedId(line.id));

    const client = supabase;
    if (client) {
      client.from('client_claims').upsert(newClaim).then(({ error }) => {
        if (error) {
          console.error('Supabase saveClientClaim error:', error);
        } else {
          this.trackSyncedId(newClaim.id);
          client.from('client_claim_lines').delete().eq('claim_id', newClaim.id).then(() => {
            client.from('client_claim_lines').insert(newLines).then(({ error: linesErr }) => {
              if (linesErr) {
                console.error('Supabase saveClientClaimLines error:', linesErr);
              } else {
                newLines.forEach(line => this.trackSyncedId(line.id));
              }
            });
          });
        }
      });
    }

    return newClaim;
  }

  deleteClientClaim(claimId: string): void {
    this.trackDeletion(claimId);
    this.untrackSyncedId(claimId);
    const claims = this.get<ClientClaim>('client_claims', []);
    const updatedClaims = claims.filter(c => c.id !== claimId);
    this.save('client_claims', updatedClaims);

    const lines = this.get<ClientClaimLine>('client_claim_lines', []);
    const updatedLines = lines.filter(l => l.claim_id !== claimId);
    this.save('client_claim_lines', updatedLines);

    if (supabase) {
      supabase.from('client_claims').delete().eq('id', claimId).then(({ error }) => {
        if (error) console.error('Supabase deleteClientClaim error:', error);
      });
    }
  }

  getBOQExecutedValue(boqItemId: string, asOfDate?: string): number {
    const issues = this.get<MaterialIssue>('material_issues', []);
    const issueLines = this.get<IssueLine>('issue_lines', []);
    
    const filteredIssues = asOfDate 
      ? issues.filter(i => new Date(i.issue_date) <= new Date(asOfDate))
      : issues;
      
    const issueIds = new Set(filteredIssues.map(i => i.id));
    const lines = issueLines.filter(l => l.boq_item_id === boqItemId && issueIds.has(l.issue_id));
    
    const qty = lines.reduce((sum, l) => sum + l.qty_issued + l.qty_wastage, 0);
    const boqItem = this.get<BOQItem>('boq', []).find(b => b.id === boqItemId);
    const rate = boqItem ? boqItem.unit_rate : 0;
    
    return qty * rate;
  }

  // --- Suppliers CRUD ---
  getSuppliers(): Supplier[] {
    return this.get<Supplier>('suppliers', INITIAL_SUPPLIERS);
  }

  saveSupplier(supplier: Omit<Supplier, 'id' | 'created_at'> & { id?: string }): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier: Supplier = {
      ...supplier,
      id: supplier.id || generateUUID(),
      created_at: new Date().toISOString()
    };
    const index = suppliers.findIndex(s => s.id === newSupplier.id);
    if (index >= 0) {
      suppliers[index] = newSupplier;
    } else {
      suppliers.push(newSupplier);
    }
    this.save('suppliers', suppliers);

    this.untrackSyncedId(newSupplier.id);

    if (supabase) {
      supabase.from('suppliers').upsert(newSupplier).then(({ error }) => {
        if (error) {
          console.error('Supabase saveSupplier error:', error);
        } else {
          this.trackSyncedId(newSupplier.id);
        }
      });
    }

    return newSupplier;
  }

  deleteSupplier(id: string): void {
    this.trackDeletion(id);
    this.untrackSyncedId(id);
    let suppliers = this.getSuppliers();
    suppliers = suppliers.filter(s => s.id !== id);
    this.save('suppliers', suppliers);

    if (supabase) {
      supabase.from('suppliers').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteSupplier error:', error);
      });
    }
  }

  // --- Purchase Orders ---
  getPOs(projectId?: string): PurchaseOrder[] {
    const pos = this.get<PurchaseOrder>('pos', []);
    return projectId ? pos.filter(po => po.project_id === projectId) : pos;
  }

  getPOLines(poId?: string): PurchaseOrderLine[] {
    const lines = this.get<PurchaseOrderLine>('po_lines', []);
    return poId ? lines.filter(l => l.po_id === poId) : lines;
  }

  savePO(
    po: Omit<PurchaseOrder, 'id' | 'created_at'> & { id?: string },
    lines: Omit<PurchaseOrderLine, 'id' | 'po_id' | 'created_at'>[]
  ): PurchaseOrder {
    const pos = this.getPOs();
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);

    const newPO: PurchaseOrder = {
      ...po,
      id: po.id || generateUUID(),
      created_at: new Date().toISOString()
    };

    // Remove old lines if editing
    const filteredLines = allLines.filter(l => l.po_id !== newPO.id);

    // Save PO
    const index = pos.findIndex(p => p.id === newPO.id);
    if (index >= 0) {
      pos[index] = newPO;
    } else {
      pos.push(newPO);
    }
    this.save('pos', pos);

    // Add new lines
    const newLines = lines.map((line) => ({
      ...line,
      id: generateUUID(),
      po_id: newPO.id,
      created_at: new Date().toISOString()
    }));
    filteredLines.push(...newLines);
    this.save('po_lines', filteredLines);

    this.untrackSyncedId(newPO.id);
    newLines.forEach(line => this.untrackSyncedId(line.id));

    const client = supabase;
    if (client) {
      client.from('purchase_order_lines').delete().eq('po_id', newPO.id).then(({ error: delErr }) => {
        if (delErr) console.error('Supabase savePO lines delete error:', delErr);
        client.from('purchase_orders').upsert(newPO).then(({ error: poErr }) => {
          if (poErr) {
            console.error('Supabase savePO upsert error:', poErr);
          } else {
            this.trackSyncedId(newPO.id);
          }
          client.from('purchase_order_lines').insert(newLines).then(({ error: insErr }) => {
            if (insErr) {
              console.error('Supabase savePO lines insert error:', insErr);
            } else {
              newLines.forEach(line => this.trackSyncedId(line.id));
            }
          });
        });
      });
    }

    return newPO;
  }

  updatePOStatus(poId: string, status: PurchaseOrder['status']): void {
    const pos = this.getPOs();
    const po = pos.find(p => p.id === poId);
    if (po) {
      po.status = status;
      this.save('pos', pos);
      this.untrackSyncedId(poId);

      if (supabase) {
        supabase.from('purchase_orders').update({ status }).eq('id', poId).then(({ error }) => {
          if (error) {
            console.error('Supabase updatePOStatus error:', error);
          } else {
            this.trackSyncedId(poId);
          }
        });
      }
    }
  }

  getLastPurchasePrice(boqItemId: string, currentProjectId: string): { price: number; isOtherProject: boolean; projectName?: string } | null {
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);
    const pos = this.get<PurchaseOrder>('pos', []).filter(po => po.status !== 'draft');
    const boqItems = this.get<BOQItem>('boq', []);
    const projects = this.getProjects();

    const selectedBOQ = boqItems.find(b => b.id === boqItemId);
    if (!selectedBOQ) return null;

    // 1. Search in current project first
    const currentProjLines = allLines
      .filter(l => l.boq_item_id === boqItemId && pos.some(po => po.id === l.po_id && po.project_id === currentProjectId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (currentProjLines.length > 0) {
      return { price: currentProjLines[0].unit_rate, isOtherProject: false };
    }

    // 2. Search in other projects for matching code or exact description
    const otherProjLines = allLines
      .filter(l => {
        const otherBOQ = boqItems.find(b => b.id === l.boq_item_id);
        if (!otherBOQ) return false;
        
        const isMatch = otherBOQ.item_code === selectedBOQ.item_code || 
                        otherBOQ.description.toLowerCase() === selectedBOQ.description.toLowerCase();
        
        return isMatch && pos.some(po => po.id === l.po_id && po.project_id !== currentProjectId);
      });

    if (otherProjLines.length > 0) {
      const sortedOtherLines = otherProjLines.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const po = pos.find(p => p.id === sortedOtherLines[0].po_id);
      const proj = projects.find(p => p.id === po?.project_id);
      
      return {
        price: sortedOtherLines[0].unit_rate,
        isOtherProject: true,
        projectName: proj?.name
      };
    }

    return null;
  }

  deletePO(poId: string): void {
    this.trackDeletion(poId);
    this.untrackSyncedId(poId);
    
    const pos = this.get<PurchaseOrder>('pos', []);
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);

    // Untrack lines as well
    const linesToUntrack = allLines.filter(l => l.po_id === poId);
    linesToUntrack.forEach(l => this.untrackSyncedId(l.id));

    const updatedPos = pos.filter(po => po.id !== poId);
    const updatedLines = allLines.filter(l => l.po_id !== poId);

    // Cascading delete of GRNs and GRN lines locally
    const grns = this.get<any>('grns', []);
    const grnLines = this.get<any>('grn_lines', []);
    const grnsToDelete = grns.filter((g: any) => g.po_id === poId);
    const grnIdsToDelete = new Set(grnsToDelete.map((g: any) => g.id));
    const updatedGrns = grns.filter((g: any) => g.po_id !== poId);
    const updatedGrnLines = grnLines.filter((l: any) => !grnIdsToDelete.has(l.grn_id));

    grnsToDelete.forEach((g: any) => {
      this.untrackSyncedId(g.id);
      const gls = grnLines.filter((gl: any) => gl.grn_id === g.id);
      gls.forEach((gl: any) => this.untrackSyncedId(gl.id));
    });

    this.save('pos', updatedPos);
    this.save('po_lines', updatedLines);
    this.save('grns', updatedGrns);
    this.save('grn_lines', updatedGrnLines);

    if (supabase) {
      // Cascading delete is configured in DB, but let's delete PO directly
      supabase.from('purchase_orders').delete().eq('id', poId).then(({ error }) => {
        if (error) console.error('Supabase deletePO error:', error);
      });
    }
  }

  getSimilarItemPurchasePrice(query: string): { price: number; description: string; projectName: string } | null {
    if (!query || query.trim().length < 3) return null;
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);
    const pos = this.get<PurchaseOrder>('pos', []).filter(po => po.status !== 'draft');
    const boqItems = this.get<BOQItem>('boq', []);
    const projects = this.getProjects();

    const normalizedQuery = query.trim().toLowerCase();

    // Filter lines where item_code or description matches query
    const matchingLines = allLines.filter(l => {
      const boq = boqItems.find(b => b.id === l.boq_item_id);
      if (!boq) return false;
      return boq.item_code.toLowerCase().includes(normalizedQuery) || 
             boq.description.toLowerCase().includes(normalizedQuery);
    });

    if (matchingLines.length > 0) {
      const sortedLines = matchingLines.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const po = pos.find(p => p.id === sortedLines[0].po_id);
      if (po) {
        const proj = projects.find(p => p.id === po.project_id);
        const matchedBOQ = boqItems.find(b => b.id === sortedLines[0].boq_item_id);
        if (proj && matchedBOQ) {
          return {
            price: sortedLines[0].unit_rate,
            description: matchedBOQ.description,
            projectName: proj.name
          };
        }
      }
    }
    return null;
  }

  getHistoricalBOQSuggestions(): { description: string; item_code: string; unit: string; unit_rate: number; project_name: string }[] {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const projects = this.getProjects();
    
    const uniqueMap = new Map<string, { description: string; item_code: string; unit: string; unit_rate: number; project_name: string }>();
    
    items.forEach(item => {
      if (!item.description) return;
      const key = item.description.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        const proj = projects.find(p => p.id === item.project_id);
        uniqueMap.set(key, {
          description: item.description,
          item_code: item.item_code,
          unit: item.unit,
          unit_rate: item.unit_rate,
          project_name: proj ? proj.name : 'Unknown Project'
        });
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  getSimilarPurchaseHistory(query: string): { price: number; description: string; projectName: string; date: string; supplierName: string; poNumber: string }[] {
    if (!query || query.trim().length < 2) return [];
    
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);
    const pos = this.get<PurchaseOrder>('pos', []).filter(po => po.status !== 'draft');
    const boqItems = this.get<BOQItem>('boq', INITIAL_BOQ);
    const projects = this.getProjects();
    const suppliers = this.getSuppliers();
    
    const normalizedQuery = query.trim().toLowerCase();
    
    interface TempResult {
      price: number;
      description: string;
      projectName: string;
      createdAt: string;
      date: string;
      supplierName: string;
      poNumber: string;
    }
    
    const results: TempResult[] = [];
    
    allLines.forEach(l => {
      const boq = boqItems.find(b => b.id === l.boq_item_id);
      const boqDesc = boq?.description || '';
      const boqCode = boq?.item_code || '';
      const lineDesc = l.description || '';
      
      const isMatch = boqDesc.toLowerCase().includes(normalizedQuery) ||
                      boqCode.toLowerCase().includes(normalizedQuery) ||
                      lineDesc.toLowerCase().includes(normalizedQuery);
                      
      if (isMatch) {
        const po = pos.find(p => p.id === l.po_id);
        if (po) {
          const proj = projects.find(p => p.id === po.project_id);
          const supplier = suppliers.find(s => s.id === po.supplier_id);
          const timestamp = l.created_at || po.created_at;
          results.push({
            price: l.unit_rate,
            description: lineDesc || boqDesc,
            projectName: proj ? proj.name : 'Unknown Project',
            createdAt: timestamp,
            date: new Date(timestamp).toLocaleDateString('en-GB'),
            supplierName: supplier ? supplier.name : 'Unknown Supplier',
            poNumber: po.po_number
          });
        }
      }
    });
    
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return results.slice(0, 5).map(({ price, description, projectName, date, supplierName, poNumber }) => ({
      price,
      description,
      projectName,
      date,
      supplierName,
      poNumber
    }));
  }


  // --- Goods Receipt Notes ---
  getGRNs(projectId?: string): GoodsReceiptNote[] {
    const grns = this.get<GoodsReceiptNote>('grns', []);
    return projectId ? grns.filter(g => g.project_id === projectId) : grns;
  }

  getGRNLines(grnId: string): GRNLine[] {
    const lines = this.get<GRNLine>('grn_lines', []);
    return lines.filter(l => l.grn_id === grnId);
  }

  saveGRN(
    grn: Omit<GoodsReceiptNote, 'id' | 'created_at'> & { id?: string },
    lines: Omit<GRNLine, 'id' | 'grn_id' | 'created_at'>[]
  ): GoodsReceiptNote {
    const grns = this.getGRNs();
    const allLines = this.get<GRNLine>('grn_lines', []);
    const isEdit = !!grn.id;

    const newGRN: GoodsReceiptNote = {
      ...grn,
      id: grn.id || generateUUID(),
      created_at: grn.id 
        ? (grns.find(g => g.id === grn.id)?.created_at || new Date().toISOString())
        : new Date().toISOString()
    };

    // Save GRN
    const index = grns.findIndex(g => g.id === newGRN.id);
    if (index >= 0) {
      grns[index] = newGRN;
    } else {
      grns.push(newGRN);
    }
    this.save('grns', grns);

    // Filter out old lines if editing
    const filteredLines = isEdit ? allLines.filter(l => l.grn_id !== newGRN.id) : allLines;

    // Add lines
    const newLines = lines.map((line) => ({
      ...line,
      id: generateUUID(),
      grn_id: newGRN.id,
      created_at: new Date().toISOString()
    }));
    filteredLines.push(...newLines);
    this.save('grn_lines', filteredLines);

    // Update PO status automatically based on received quantities
    this.recalculatePOStatus(newGRN.po_id);

    this.untrackSyncedId(newGRN.id);
    newLines.forEach(line => this.untrackSyncedId(line.id));

    const client = supabase;
    if (client) {
      if (isEdit) {
        client.from('grn_lines').delete().eq('grn_id', newGRN.id).then(() => {
          client.from('goods_receipt_notes').upsert(newGRN).then(({ error: grnErr }) => {
            if (grnErr) {
              console.error('Supabase saveGRN edit error:', grnErr);
            } else {
              this.trackSyncedId(newGRN.id);
            }
            client.from('grn_lines').insert(newLines).then(({ error: linesErr }) => {
              if (linesErr) {
                console.error('Supabase saveGRN edit lines error:', linesErr);
              } else {
                newLines.forEach(line => this.trackSyncedId(line.id));
              }
            });
          });
        });
      } else {
        client.from('goods_receipt_notes').insert(newGRN).then(({ error: grnErr }) => {
          if (grnErr) {
            console.error('Supabase saveGRN error:', grnErr);
          } else {
            this.trackSyncedId(newGRN.id);
          }
          client.from('grn_lines').insert(newLines).then(({ error: linesErr }) => {
            if (linesErr) {
              console.error('Supabase saveGRN lines error:', linesErr);
            } else {
              newLines.forEach(line => this.trackSyncedId(line.id));
            }
          });
        });
      }
    }

    return newGRN;
  }

  private recalculatePOStatus(poId: string): void {
    const poLines = this.getPOLines(poId);
    const grns = this.get<GoodsReceiptNote>('grns', []).filter(g => g.po_id === poId);
    const allGRNLines = this.get<GRNLine>('grn_lines', []);

    let totalOrdered = 0;
    let totalReceived = 0;

    poLines.forEach(pol => {
      totalOrdered += pol.qty;
      const rec = allGRNLines
        .filter(gl => gl.po_line_id === pol.id)
        .reduce((sum, current) => sum + current.qty_received, 0);
      totalReceived += rec;
    });

    let newStatus: PurchaseOrder['status'] = 'issued';
    if (totalReceived > 0) {
      if (totalReceived >= totalOrdered) {
        newStatus = 'closed';
      } else {
        newStatus = 'partially_received';
      }
    }
    this.updatePOStatus(poId, newStatus);
  }

  // --- Material Issues (Site consumption) ---
  getMaterialIssues(projectId?: string): MaterialIssue[] {
    const issues = this.get<MaterialIssue>('material_issues', []);
    return projectId ? issues.filter(i => i.project_id === projectId) : issues;
  }

  getIssueLines(issueId: string): IssueLine[] {
    const lines = this.get<IssueLine>('issue_lines', []);
    return lines.filter(l => l.issue_id === issueId);
  }

  saveMaterialIssue(
    issue: Omit<MaterialIssue, 'id' | 'created_at'> & { id?: string },
    lines: Omit<IssueLine, 'id' | 'issue_id' | 'created_at'>[]
  ): MaterialIssue {
    // Database-level check to strictly enforce stock limits
    lines.forEach(l => {
      const summary = this.getBOQWorkflowSummary(issue.project_id).find(b => b.id === l.boq_item_id);
      const stock = summary ? summary.stock_balance : 0;
      if (l.qty_issued > stock) {
        throw new Error(`Database Violation: Cannot issue ${l.qty_issued} units for item "${summary?.description || 'Item'}". Only ${stock} units are currently in stock.`);
      }
    });

    const issues = this.getMaterialIssues();
    const allLines = this.get<IssueLine>('issue_lines', []);

    const newIssue: MaterialIssue = {
      ...issue,
      id: issue.id || generateUUID(),
      created_at: new Date().toISOString()
    };

    issues.push(newIssue);
    this.save('material_issues', issues);

    const newLines = lines.map((line) => ({
      ...line,
      id: generateUUID(),
      issue_id: newIssue.id,
      created_at: new Date().toISOString()
    }));
    allLines.push(...newLines);
    this.save('issue_lines', allLines);

    this.untrackSyncedId(newIssue.id);
    newLines.forEach(line => this.untrackSyncedId(line.id));

    const client = supabase;
    if (client) {
      client.from('material_issues').insert(newIssue).then(({ error: issueErr }) => {
        if (issueErr) {
          console.error('Supabase saveMaterialIssue error:', issueErr);
        } else {
          this.trackSyncedId(newIssue.id);
        }
        client.from('issue_lines').insert(newLines).then(({ error: linesErr }) => {
          if (linesErr) {
            console.error('Supabase saveMaterialIssue lines error:', linesErr);
          } else {
            newLines.forEach(line => this.trackSyncedId(line.id));
          }
        });
      });
    }

    return newIssue;
  }

  deleteGRN(grnId: string): void {
    this.trackDeletion(grnId);
    this.untrackSyncedId(grnId);
    const grns = this.get<GoodsReceiptNote>('grns', []);
    const grn = grns.find(g => g.id === grnId);
    if (!grn) return;

    // Filter out the GRN
    this.save('grns', grns.filter(g => g.id !== grnId));

    // Filter out associated GRN lines
    const allLines = this.get<GRNLine>('grn_lines', []);
    const linesToUntrack = allLines.filter(l => l.grn_id === grnId);
    linesToUntrack.forEach(l => this.untrackSyncedId(l.id));

    this.save('grn_lines', allLines.filter(l => l.grn_id !== grnId));

    // Recalculate PO status
    this.recalculatePOStatus(grn.po_id);

    const client = supabase;
    if (client) {
      client.from('goods_receipt_notes').delete().eq('id', grnId).then(({ error }) => {
        if (error) console.error('Supabase deleteGRN error:', error);
      });
    }
  }

  deleteMaterialIssue(issueId: string): void {
    this.trackDeletion(issueId);
    this.untrackSyncedId(issueId);
    const issues = this.get<MaterialIssue>('material_issues', []);
    this.save('material_issues', issues.filter(i => i.id !== issueId));

    const allLines = this.get<IssueLine>('issue_lines', []);
    const linesToUntrack = allLines.filter(l => l.issue_id === issueId);
    linesToUntrack.forEach(l => this.untrackSyncedId(l.id));

    this.save('issue_lines', allLines.filter(l => l.issue_id !== issueId));

    const client = supabase;
    if (client) {
      client.from('material_issues').delete().eq('id', issueId).then(({ error }) => {
        if (error) console.error('Supabase deleteMaterialIssue error:', error);
      });
    }
  }

  // --- Advanced Calculations for BOQ Workflow ---
  // Returns item-level status (planned, approved, ordered, received, consumed, balance)
  getBOQWorkflowSummary(projectId: string) {
    const boqItems = this.getBOQItems(projectId);
    const pos = this.getPOs(projectId);
    const allPOLines = this.get<PurchaseOrderLine>('po_lines', []);
    const grns = this.getGRNs(projectId);
    const allGRNLines = this.get<GRNLine>('grn_lines', []);
    const issues = this.getMaterialIssues(projectId);
    const allIssueLines = this.get<IssueLine>('issue_lines', []);

    return boqItems.map(item => {
      // Ordered: sum from PO lines that are not draft
      const activePOs = pos.filter(po => po.status !== 'draft');
      const poLines = allPOLines.filter(
        pol => pol.boq_item_id === item.id && activePOs.some(po => po.id === pol.po_id)
      );
      const orderedQty = poLines.reduce((sum, pol) => sum + pol.qty, 0);

      // Received: sum from GRN lines
      const activeGRNs = grns.filter(g => activePOs.some(po => po.id === g.po_id));
      const grnLines = allGRNLines.filter(
        gl => activeGRNs.some(g => g.id === gl.grn_id) && poLines.some(pol => pol.id === gl.po_line_id)
      );
      const receivedQty = grnLines.reduce((sum, gl) => sum + gl.qty_received, 0);

      // Consumed: sum from Issue lines
      const issueLines = allIssueLines.filter(
        il => il.boq_item_id === item.id && issues.some(i => i.id === il.issue_id)
      );
      const consumedQty = issueLines.reduce((sum, il) => sum + il.qty_issued, 0);
      const wastageQty = issueLines.reduce((sum, il) => sum + il.qty_wastage, 0);

      // Stock available on site = Received - Consumed
      const stockBalance = Math.max(0, receivedQty - consumedQty - wastageQty);

      // Balance BOQ Qty = Approved - Ordered
      const boqBalanceQty = Math.max(0, item.approved_qty - orderedQty);

      return {
        ...item,
        ordered_qty: orderedQty,
        received_qty: receivedQty,
        consumed_qty: consumedQty,
        wastage_qty: wastageQty,
        stock_balance: stockBalance,
        boq_balance: boqBalanceQty
      };
    });
  }

  getReceivedItemsReport(projectId: string): any[] {
    const grns = this.getGRNs(projectId);
    const grnLines = this.get<GRNLine>('grn_lines', []);
    const poLines = this.get<PurchaseOrderLine>('po_lines', []);
    const pos = this.getPOs(projectId);
    const boqItems = this.getBOQItems(projectId);

    const report: any[] = [];
    
    grns.forEach(grn => {
      const lines = grnLines.filter(gl => gl.grn_id === grn.id);
      const po = pos.find(p => p.id === grn.po_id);
      
      lines.forEach(line => {
        const poLine = poLines.find(pol => pol.id === line.po_line_id);
        const boqItem = poLine ? boqItems.find(b => b.id === poLine.boq_item_id) : null;
        
        report.push({
          grn_number: grn.grn_number,
          received_date: grn.received_date,
          received_by: grn.received_by,
          delivery_note_number: grn.delivery_note_number || '',
          po_number: po ? po.po_number : 'N/A',
          item_code: boqItem ? boqItem.item_code : 'N/A',
          description: poLine ? poLine.description : (boqItem ? boqItem.description : 'Unknown'),
          unit: boqItem ? boqItem.unit : '',
          qty_received: line.qty_received,
          unit_rate: poLine ? poLine.unit_rate : 0
        });
      });
    });

    return report.sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime());
  }

  // --- Financial Reporting Engine ---
  getFinancialCostSummary(projectId: string, asOfDate?: string) {
    const project = this.getProjects().find(p => p.id === projectId);
    if (!project) return null;

    const filterDate = asOfDate ? new Date(asOfDate) : null;

    // Filter data up to the date
    const checkDate = (dateStr: string) => {
      if (!filterDate) return true;
      return new Date(dateStr) <= filterDate;
    };

    const boqItems = this.getBOQItems(projectId);
    const pos = this.getPOs(projectId).filter(po => checkDate(po.created_at));
    const allPOLines = this.get<PurchaseOrderLine>('po_lines', []);
    const grns = this.getGRNs(projectId).filter(g => checkDate(g.received_date));
    const allGRNLines = this.get<GRNLine>('grn_lines', []);
    const issues = this.getMaterialIssues(projectId).filter(i => checkDate(i.issue_date));
    const allIssueLines = this.get<IssueLine>('issue_lines', []);

    // Summary calculations
    let boqTotalExcl = boqItems.reduce((sum, item) => sum + item.approved_qty * item.unit_rate, 0);
    let boqVat = boqItems.reduce((sum, item) => sum + item.approved_qty * item.unit_rate * (item.vat_rate / 100), 0);

    let poIssuedExcl = 0;
    let poVat = 0;

    let receivedValueExcl = 0;
    let receivedVat = 0;

    let usedValueExcl = 0;
    let usedVat = 0;

    // PO Calculations
    pos.forEach(po => {
      const lines = allPOLines.filter(l => l.po_id === po.id);
      lines.forEach(line => {
        const lineExcl = line.qty * line.unit_rate;
        const lineVat = lineExcl * (line.vat_rate / 100);
        poIssuedExcl += lineExcl;
        poVat += lineVat;

        // GRN matching this PO line
        const grnsForPo = grns.filter(g => g.po_id === po.id);
        const grnLines = allGRNLines.filter(
          gl => gl.po_line_id === line.id && grnsForPo.some(g => g.id === gl.grn_id)
        );
        const qtyRec = grnLines.reduce((sum, gl) => sum + gl.qty_received, 0);

        receivedValueExcl += qtyRec * line.unit_rate;
        receivedVat += qtyRec * line.unit_rate * (line.vat_rate / 100);
      });
    });

    // Material issues value based on PO / BOQ unit cost
    issues.forEach(issue => {
      const lines = allIssueLines.filter(l => l.issue_id === issue.id);
      lines.forEach(line => {
        const boqItem = boqItems.find(b => b.id === line.boq_item_id);
        const rate = boqItem ? boqItem.unit_rate : 0;
        const vatRate = boqItem ? boqItem.vat_rate : 5.0;

        const consumedTotal = line.qty_issued + line.qty_wastage;
        usedValueExcl += consumedTotal * rate;
        usedVat += consumedTotal * rate * (vatRate / 100);
      });
    });

    // Committed value remaining = PO Issued Value - Received Value
    const remainingCommittedExcl = Math.max(0, poIssuedExcl - receivedValueExcl);
    const remainingCommittedVat = Math.max(0, poVat - receivedVat);

    // Remaining BOQ value = BOQ Total - PO Issued Value
    const remainingBoqExcl = Math.max(0, boqTotalExcl - poIssuedExcl);
    const remainingBoqVat = Math.max(0, boqVat - poVat);

    return {
      boq_total: { excl: boqTotalExcl, vat: boqVat, incl: boqTotalExcl + boqVat },
      po_issued: { excl: poIssuedExcl, vat: poVat, incl: poIssuedExcl + poVat },
      received: { excl: receivedValueExcl, vat: receivedVat, incl: receivedValueExcl + receivedVat },
      used: { excl: usedValueExcl, vat: usedVat, incl: usedValueExcl + usedVat },
      remaining_committed: { excl: remainingCommittedExcl, vat: remainingCommittedVat, incl: remainingCommittedExcl + remainingCommittedVat },
      remaining_boq: { excl: remainingBoqExcl, vat: remainingBoqVat, incl: remainingBoqExcl + remainingBoqVat }
    };
  }

  async syncTable<T extends { id: string }>(
    key: string,
    tableName: string,
    initial: T[],
    cleanPayload?: (item: T) => any
  ): Promise<void> {
    if (!supabase) return;
    try {
      let localItems = this.get<T>(key, initial);
      const { data: dbItems, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`Supabase Sync Warning: Table "${tableName}" could not be fetched (it may not exist or lacks permissions). Local data will be used. Error message: ${JSON.stringify(error)}`);
        return;
      }

      // Track deleted records to prevent deleted records from coming back
      const deletedIds = this.get<string>('deleted_ids', []);
      const deletedSet = new Set(deletedIds);

      // 1. Process deletions on Supabase for any locally deleted items
      const dbItemsToKeep = [];
      for (const dbItem of dbItems) {
        if (deletedSet.has(dbItem.id)) {
          // Retry deletion on Supabase
          supabase.from(tableName).delete().eq('id', dbItem.id).then(({ error: delErr }) => {
            if (delErr) console.error(`Error retrying delete for ${dbItem.id} on ${tableName}:`, delErr);
          });
        } else {
          dbItemsToKeep.push(dbItem);
        }
      }

      // Self-healing merge for duplicate unique columns (PO number, GRN number, Material Issue number)
      if (tableName === 'purchase_orders') {
        const dbMap = new Map(dbItemsToKeep.map((item: any) => [item.po_number, item.id]));
        localItems.forEach((item: any) => {
          if (dbMap.has(item.po_number) && item.id !== dbMap.get(item.po_number)) {
            const dbId = dbMap.get(item.po_number) as string;
            const poLines = this.get<any>('po_lines', []);
            poLines.forEach((l: any) => { if (l.po_id === item.id) l.po_id = dbId; });
            this.save('po_lines', poLines);
            const grns = this.get<any>('grns', []);
            grns.forEach((g: any) => { if (g.po_id === item.id) g.po_id = dbId; });
            this.save('grns', grns);
            item.id = dbId;
          }
        });
      } else if (tableName === 'goods_receipt_notes') {
        const dbMap = new Map(dbItemsToKeep.map((item: any) => [item.grn_number, item.id]));
        localItems.forEach((item: any) => {
          if (dbMap.has(item.grn_number) && item.id !== dbMap.get(item.grn_number)) {
            const dbId = dbMap.get(item.grn_number) as string;
            const grnLines = this.get<any>('grn_lines', []);
            grnLines.forEach((l: any) => { if (l.grn_id === item.id) l.grn_id = dbId; });
            this.save('grn_lines', grnLines);
            item.id = dbId;
          }
        });
      } else if (tableName === 'material_issues') {
        const dbMap = new Map(dbItemsToKeep.map((item: any) => [item.issue_number, item.id]));
        localItems.forEach((item: any) => {
          if (dbMap.has(item.issue_number) && item.id !== dbMap.get(item.issue_number)) {
            const dbId = dbMap.get(item.issue_number) as string;
            const issueLines = this.get<any>('issue_lines', []);
            issueLines.forEach((l: any) => { if (l.issue_id === item.id) l.issue_id = dbId; });
            this.save('issue_lines', issueLines);
            item.id = dbId;
          }
        });
      }

      // Filter out any locally deleted items from localItems
      localItems = localItems.filter(item => !deletedSet.has(item.id));

      const localMap = new Map(localItems.map(item => [item.id, item]));
      const dbMap = new Map(dbItemsToKeep.map(item => [item.id, item]));
      const syncedIds = this.getSyncedIds();

      const itemsToUpsertToDB: T[] = [];
      const finalLocalItems: T[] = [];

      // 2. Compare matching items and detect unsynced updates
      for (const localItem of localItems) {
        const dbItem = dbMap.get(localItem.id);
        if (!dbItem) {
          // Exists locally but not in DB.
          // Was this item previously synced to Supabase?
          if (syncedIds.has(localItem.id)) {
            // Yes, which means it was deleted on Supabase. Delete it locally.
            syncedIds.delete(localItem.id);
          } else {
            // No, it's a new local item that needs to be uploaded.
            itemsToUpsertToDB.push(localItem);
            finalLocalItems.push(localItem);
          }
        } else {
          // Exists in both -> Check if local has updates.
          const cleanLocal = cleanPayload ? cleanPayload(localItem) : localItem;
          const cleanDb = cleanPayload ? cleanPayload(dbItem as any) : dbItem;
          
          if (JSON.stringify(cleanLocal) !== JSON.stringify(cleanDb)) {
            itemsToUpsertToDB.push(localItem);
            finalLocalItems.push(localItem);
          } else {
            finalLocalItems.push(dbItem as any);
          }
          // Ensure it's marked as synced
          syncedIds.add(localItem.id);
        }
      }

      // 3. Add items that exist in DB but not locally (and are not deleted)
      for (const dbItem of dbItemsToKeep) {
        if (!localMap.has(dbItem.id)) {
          finalLocalItems.push(dbItem);
          syncedIds.add(dbItem.id);
        }
      }

      // 4. Upload unsynced items to Supabase
      if (itemsToUpsertToDB.length > 0) {
        const payloads = cleanPayload 
          ? itemsToUpsertToDB.map(cleanPayload) 
          : itemsToUpsertToDB;
        const { error: uploadError } = await supabase.from(tableName).upsert(payloads);
        if (uploadError) {
          console.error(`Error uploading unsynced ${tableName} to Supabase: Code: ${uploadError.code} | Message: ${uploadError.message}`, uploadError);
        } else {
          // Successfully uploaded -> track in synced_ids
          itemsToUpsertToDB.forEach(item => syncedIds.add(item.id));
        }
      }

      this.saveSyncedIds(syncedIds);

      // 5. Save final merged list to local storage
      this.save(key, finalLocalItems);
    } catch (e) {
      console.error(`Failed to sync table ${tableName}:`, e);
    }
  }

  async syncFromSupabase(): Promise<void> {
    if (!supabase) return;

    // Self-healing: Clean up orphaned local GRNs referencing non-existent POs
    const localPos = this.get<any>('pos', []);
    const poIds = new Set(localPos.map((po: any) => po.id));
    const localGrns = this.get<any>('grns', []);
    const orphanedGrns = localGrns.filter((g: any) => !poIds.has(g.po_id));
    if (orphanedGrns.length > 0) {
      console.log(`Cleaning up ${orphanedGrns.length} orphaned GRNs from local storage.`);
      const orphanedIds = new Set(orphanedGrns.map((g: any) => g.id));
      const activeGrns = localGrns.filter((g: any) => poIds.has(g.po_id));
      this.save('grns', activeGrns);
      const localGrnLines = this.get<any>('grn_lines', []);
      const activeGrnLines = localGrnLines.filter((l: any) => !orphanedIds.has(l.grn_id));
      this.save('grn_lines', activeGrnLines);
    }

    await this.syncTable<Project>('projects', 'projects', INITIAL_PROJECTS, (item: any) => {
      const { tin_number, ...payload } = item;
      if (item.tin_number && !item.cr_number) {
        payload.cr_number = item.tin_number;
      }
      return payload;
    });
    await this.syncTable<BOQItem>('boq', 'boq_items', INITIAL_BOQ, (item) => {
      const { subtotal, client_item_code, ...payload } = item as any;
      return payload;
    });
    await this.syncTable<Supplier>('suppliers', 'suppliers', INITIAL_SUPPLIERS, (item: any) => {
      const { tin_number, ...payload } = item;
      if (item.tin_number && !item.cr_number) {
        payload.cr_number = item.tin_number;
      }
      return payload;
    });
    await this.syncTable<any>('pos', 'purchase_orders', [], (item: any) => {
      // Only send DB columns for purchase_orders
      const { ...payload } = item;
      return payload;
    });
    await this.syncTable<any>('po_lines', 'purchase_order_lines', [], (item: any) => {
      // Strip any client-side computed fields; ensure boq_item_id can be null
      return {
        id: item.id,
        po_id: item.po_id,
        boq_item_id: item.boq_item_id || null,
        description: item.description,
        qty: item.qty,
        unit_rate: item.unit_rate,
        vat_rate: item.vat_rate,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('grns', 'goods_receipt_notes', [], (item: any) => {
      return {
        id: item.id,
        grn_number: item.grn_number,
        po_id: item.po_id,
        project_id: item.project_id,
        received_date: item.received_date,
        received_by: item.received_by,
        delivery_note_number: item.delivery_note_number || null,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('grn_lines', 'grn_lines', [], (item: any) => {
      return {
        id: item.id,
        grn_id: item.grn_id,
        po_line_id: item.po_line_id,
        qty_received: item.qty_received,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('material_issues', 'material_issues', [], (item: any) => {
      return {
        id: item.id,
        issue_number: item.issue_number,
        project_id: item.project_id,
        issue_date: item.issue_date,
        issued_to_location: item.issued_to_location,
        issued_by: item.issued_by,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('issue_lines', 'issue_lines', [], (item: any) => {
      return {
        id: item.id,
        issue_id: item.issue_id,
        po_line_id: item.po_line_id,
        qty_issued: item.qty_issued,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('client_boq', 'client_boq_items', [], (item: any) => {
      return {
        id: item.id,
        project_id: item.project_id,
        item_code: item.item_code,
        description: item.description,
        unit: item.unit || null,
        qty: item.qty || null,
        value: item.value ?? 0,
        section: item.section || null,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('client_claims', 'client_claims', []);
    await this.syncTable<any>('client_claim_lines', 'client_claim_lines', []);
    await this.syncTable<any>('users', 'users', [], (item: any) => {
      return {
        id: item.id,
        username: item.username,
        role: item.role,
        password_hash: item.password_hash,
        created_at: item.created_at
      };
    });

    // Sync company details if client
    if (this.isClient) {
      try {
        const { data: dbDetails, error: detailsErr } = await supabase.from('company_details').select('*').eq('id', 'current_config').maybeSingle();
        if (!detailsErr && dbDetails) {
          const { created_at, id, ...cleanDetails } = dbDetails;
          localStorage.setItem('pms_company_details', JSON.stringify(cleanDetails));
        } else if (!detailsErr && !dbDetails) {
          const local = localStorage.getItem('pms_company_details');
          if (local) {
            try {
              const parsed = JSON.parse(local);
              await supabase.from('company_details').upsert({ id: 'current_config', ...parsed });
            } catch (e) {
              console.error('Failed to upload local company details to Supabase:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to sync company details from Supabase:', e);
      }
      // Sync role permissions
      try {
        const { data: dbPermissions, error: permErr } = await supabase.from('role_permissions').select('*');
        if (!permErr && dbPermissions && dbPermissions.length > 0) {
          const matrix: PermissionMatrix = {};
          dbPermissions.forEach((row: any) => {
            matrix[row.module] = {
              Admin: row.admin_access,
              Purchase: row.purchase_access,
              Site: row.site_access
            };
          });
          localStorage.setItem('pms_permissions', JSON.stringify(matrix));
        } else if (!permErr && (!dbPermissions || dbPermissions.length === 0)) {
          const local = localStorage.getItem('pms_permissions');
          if (local) {
            try {
              const parsed = JSON.parse(local) as PermissionMatrix;
              const rows = Object.entries(parsed).map(([module, access]) => ({
                module,
                admin_access: access.Admin,
                purchase_access: access.Purchase,
                site_access: access.Site
              }));
              await supabase.from('role_permissions').upsert(rows);
            } catch (e) {
              console.error('Failed to upload local role permissions to Supabase:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to sync role permissions from Supabase:', e);
      }
    }
  }

  // --- User Management ---
  getUsers(): User[] {
    return this.get<User>('users', []);
  }

  getUserByUsername(username: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  authenticate(username: string, password: string): User | null {
    const user = this.getUserByUsername(username);
    if (user && user.password_hash === password) return user;
    return null;
  }

  saveUser(user: Omit<User, 'id' | 'created_at'> & { id?: string }): User {
    const users = this.getUsers();
    const now = new Date().toISOString();

    if (user.id) {
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...user } as User;
        this.save('users', users);
        this.untrackSyncedId(user.id);
        
        const client = supabase;
        if (client) {
          client.from('users').upsert(users[idx]).then(({ error }) => {
            if (error) {
              console.error('Supabase saveUser error:', error);
            } else {
              this.trackSyncedId(user.id!);
            }
          });
        }
        return users[idx];
      }
    }

    const newUser: User = {
      ...user,
      id: user.id || `user-${Date.now()}`,
      created_at: now
    };
    users.push(newUser);
    this.save('users', users);

    this.untrackSyncedId(newUser.id);

    const client = supabase;
    if (client) {
      client.from('users').upsert(newUser).then(({ error }) => {
        if (error) {
          console.error('Supabase saveUser error:', error);
        } else {
          this.trackSyncedId(newUser.id);
        }
      });
    }

    return newUser;
  }

  deleteUser(id: string): void {
    this.trackDeletion(id);
    this.untrackSyncedId(id);
    const users = this.getUsers().filter(u => u.id !== id);
    this.save('users', users);

    const client = supabase;
    if (client) {
      client.from('users').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteUser error:', error);
      });
    }
  }

  // --- Permission Matrix ---
  getPermissions(): PermissionMatrix {
    if (!this.isClient) return DEFAULT_PERMISSION_MATRIX;
    const stored = localStorage.getItem('pms_permissions');
    if (!stored) return DEFAULT_PERMISSION_MATRIX;
    try {
      // Merge stored with defaults so new modules are included
      const parsed = JSON.parse(stored) as PermissionMatrix;
      return { ...DEFAULT_PERMISSION_MATRIX, ...parsed };
    } catch {
      return DEFAULT_PERMISSION_MATRIX;
    }
  }

  savePermissions(matrix: PermissionMatrix): void {
    if (this.isClient) {
      localStorage.setItem('pms_permissions', JSON.stringify(matrix));
      if (supabase) {
        const rows = Object.entries(matrix).map(([module, access]) => ({
          module,
          admin_access: access.Admin,
          purchase_access: access.Purchase,
          site_access: access.Site
        }));
        supabase.from('role_permissions').upsert(rows).then(({ error }) => {
          if (error) console.error('Supabase savePermissions error:', error);
        });
      }
    }
  }

  resetPermissions(): PermissionMatrix {
    if (this.isClient) {
      localStorage.removeItem('pms_permissions');
    }
    return DEFAULT_PERMISSION_MATRIX;
  }
  // --- Company Settings Configuration ---
  getCompanyDetails() {
    const defaultDetails = {
      name: 'DIMAH AL RAEDAH SPC',
      address: 'Muscat, Sultanate of Oman',
      vat_number: 'OM110023456',
      cr_number: '987654321',
      logo: '' // base64 or url string
    };
    if (!this.isClient) return defaultDetails;
    const stored = localStorage.getItem('pms_company_details');
    if (!stored) return defaultDetails;
    try {
      return { ...defaultDetails, ...JSON.parse(stored) };
    } catch {
      return defaultDetails;
    }
  }

  saveCompanyDetails(details: { name: string; address: string; vat_number: string; cr_number: string; logo: string }): void {
    if (this.isClient) {
      localStorage.setItem('pms_company_details', JSON.stringify(details));
      
      // Update Supabase if client is available
      const client = supabase;
      if (client) {
        client.from('company_details').upsert({ id: 'current_config', ...details }).then(({ error }) => {
          if (error) console.error('Supabase saveCompanyDetails error:', error);
        });
      }
    }
  }
}

export const db = new DatabaseManager();
export default db;
