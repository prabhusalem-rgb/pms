// Oman PMS Database Adapter with Supabase Integration and localStorage fallback
// Supports 5% standard Oman VAT and Multi-Project Management
import { supabase } from './supabase';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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
  boq_approved?: boolean;
  boq_approved_by?: string;
  boq_approved_at?: string;
  signed_boq_copy?: string | null;
  signed_boq_name?: string | null;
  zoho_project_id?: string | null;
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
  client_boq_sub_section?: string | null;
  created_at: string;
  zoho_item_id?: string | null;
  is_manpower_cost?: boolean;
  sort_order?: number;
  frozen_qty?: number | null;
  frozen_rate?: number | null;
}

export interface InternalManpowerClientLink {
  id: string;
  internal_boq_item_id: string;
  client_boq_item_id: string;
  allocation_weight: number;
  created_at: string;
}

export interface ClientBOQItem {
  id: string;
  project_id: string;
  item_code: string;
  description: string;
  value: number;
  section?: string | null;
  sub_section?: string | null;
  unit?: string | null;
  qty?: number | null;
  unit_rate?: number | null;
  sort_order?: number;
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
  type: 'Material Supplier' | 'Subcontractor' | 'Both';
  contact_person: string;
  email: string;
  phone: string;
  cr_number: string;
  vat_number: string;
  address?: string;
  created_at: string;
  zoho_contact_id?: string | null;
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
  zoho_po_id?: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  boq_item_id: string | null;
  description: string;
  supplier_description?: string;
  unit?: string;
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
  do_copy?: string | null;
  created_at: string;
}

export interface GRNLine {
  id: string;
  grn_id: string;
  po_line_id: string;
  qty_received: number;
  amount_received?: number;
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

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: string;
  due_date: string;
  boq_item_id: string | null;
  progress: number;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  sender: string;
  message: string;
  attachment_name?: string;
  attachment_data?: string; // base64 representation
  created_at: string;
}

export interface ActivityLogFieldChanged {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ActivityLog {
  id: string;
  change_summary: string;
  user_details: {
    name: string;
    userId: string;
    role: string;
  };
  timestamp: string;
  environment: 'prod' | 'staging' | 'dev';
  before_screenshot: {
    filename: string;
    description: string;
  };
  after_screenshot: {
    filename: string;
    description: string;
  };
  fields_changed: ActivityLogFieldChanged[];
  reason_or_ticket: string;
  rollback_instructions: string;
  verification_steps: string;
  created_at: string;
}


export type AccessLevel = 'Full' | 'View' | 'None';
export type ModuleKey = 'dashboard' | 'projects' | 'boq' | 'procurement' | 'suppliers' | 'inventory' | 'reports' | 'users' | 'tasks';

export interface PermissionMatrix {
  [module: string]: {
    Admin: AccessLevel;
    Purchase: AccessLevel;
    Site: AccessLevel;
  };
}

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  dashboard: { Admin: 'Full', Purchase: 'None', Site: 'None' },
  projects: { Admin: 'Full', Purchase: 'View', Site: 'View' },
  boq: { Admin: 'Full', Purchase: 'View', Site: 'View' },
  procurement: { Admin: 'Full', Purchase: 'Full', Site: 'None' },
  suppliers: { Admin: 'Full', Purchase: 'Full', Site: 'None' },
  inventory: { Admin: 'Full', Purchase: 'None', Site: 'Full' },
  reports: { Admin: 'Full', Purchase: 'View', Site: 'View' },
  users: { Admin: 'Full', Purchase: 'None', Site: 'None' },
  tasks: { Admin: 'Full', Purchase: 'Full', Site: 'Full' },
};

export interface ZohoSettings {
  clientId: string;
  clientSecret: string;
  organizationId: string;
  region: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiryTime?: number | null;
  materialAccountName?: string | null;
  subcontractAccountName?: string | null;
}

// Initial Mock Data to populate localStorage if empty
// Initial Mock Data to populate localStorage if empty
const INITIAL_PROJECTS: Project[] = [];
const INITIAL_BOQ: BOQItem[] = [];
const INITIAL_SUPPLIERS: Supplier[] = [];

function normalizeItem<T>(item: T): T {
  if (item === null || item === undefined) return item;
  const normalized: any = {};
  for (const key of Object.keys(item)) {
    const val = (item as any)[key];
    if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)) &&
      !['id', 'project_id', 'po_id', 'boq_item_id', 'supplier_id', 'client_boq_item_id', 'claim_id', 'grn_id', 'issue_id', 'item_code', 'po_number', 'grn_number', 'issue_number', 'tin_number', 'vat_number', 'cr_number', 'zoho_item_id', 'zoho_contact_id', 'zoho_po_id', 'zoho_project_id', 'phone', 'password_hash', 'username', 'unit'].includes(key)) {
      normalized[key] = Number(val);
    } else if (val === undefined) {
      normalized[key] = null;
    } else {
      normalized[key] = val;
    }
  }
  return normalized as T;
}

function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
      .filter(k => !['created_at', 'updated_at'].includes(k))
      .sort();
    const parts = keys.map(key => {
      const val = obj[key];
      let normalizedVal = val;
      if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)) &&
        !['id', 'project_id', 'po_id', 'boq_item_id', 'supplier_id', 'client_boq_item_id', 'claim_id', 'grn_id', 'issue_id', 'item_code', 'po_number', 'grn_number', 'issue_number', 'tin_number', 'vat_number', 'cr_number', 'zoho_item_id', 'zoho_contact_id', 'zoho_po_id', 'zoho_project_id', 'phone', 'password_hash', 'username', 'unit'].includes(key)) {
        normalizedVal = Number(val);
      } else if (val === undefined) {
        normalizedVal = null;
      }
      return JSON.stringify(key) + ':' + canonicalStringify(normalizedVal);
    });
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(obj);
}

async function safeUpsert(tableName: string, payload: any): Promise<{ error: any }> {
  if (!supabase) return { error: new Error('Supabase client not initialized') };
  let currentPayload = Array.isArray(payload) ? payload : [payload];
  let { error } = await supabase.from(tableName).upsert(currentPayload);
  let currentError: any = error;
  let retryCount = 0;

  while (currentError && (currentError.code === 'PGRST204' || currentError.message?.includes('PGRST204')) && retryCount < 5) {
    const match = currentError.message?.match(/Could not find the '([^']+)' column/);
    if (match && match[1]) {
      const missingColumn = match[1];
      console.warn(`Column '${missingColumn}' is missing on Supabase for table '${tableName}'. Stripping column and retrying...`);
      currentPayload = currentPayload.map((p: any) => {
        const { [missingColumn]: _, ...rest } = p;
        return rest;
      });
      retryCount++;
      const { error: retryErr } = await supabase.from(tableName).upsert(currentPayload);
      currentError = retryErr;
    } else {
      break;
    }
  }
  return { error: currentError };
}

// Helper functions for Database interactions (local storage wrapper with simple database sync APIs)
class DatabaseManager {
  private isClient = typeof window !== 'undefined';
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    if (!this.isClient) return;
    this.listeners.forEach(l => {
      try {
        l();
      } catch (e) {
        console.error('Error calling db listener:', e);
      }
    });
  }

  private trackDeletion(id: string): void {
    const deleted = this.get<string>('deleted_ids', []);
    if (!deleted.includes(id)) {
      deleted.push(id);
      this.save('deleted_ids', deleted);
    }
  }

  private getUnsyncedIds(): Set<string> {
    if (!this.isClient) return new Set();
    const stored = localStorage.getItem('pms_unsynced_ids');
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  }

  private saveUnsyncedIds(ids: Set<string>): void {
    if (this.isClient) {
      localStorage.setItem('pms_unsynced_ids', JSON.stringify(Array.from(ids)));
    }
  }

  private trackSyncedId(id: string): void {
    // When we track it as synced, we remove it from the unsynced set
    const ids = this.getUnsyncedIds();
    if (ids.has(id)) {
      ids.delete(id);
      this.saveUnsyncedIds(ids);
    }
  }

  private untrackSyncedId(id: string): void {
    // When we untrack it (meaning it was modified locally), we add it to the unsynced set
    const ids = this.getUnsyncedIds();
    if (!ids.has(id)) {
      ids.add(id);
      this.saveUnsyncedIds(ids);
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
      this.notify();
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

    if (existing) {
      this.logUserAction(`Updated details for project "${newProj.name}"`, [
        { field: 'client', oldValue: existing.client, newValue: newProj.client },
        { field: 'consultant', oldValue: existing.consultant, newValue: newProj.consultant },
        { field: 'site_location', oldValue: existing.site_location, newValue: newProj.site_location }
      ]);
    } else {
      this.logUserAction(`Created new project "${newProj.name}"`);
    }

    return newProj;
  }

  deleteProject(projectId: string): void {
    const boqItems = this.get<BOQItem>('boq', INITIAL_BOQ);
    const hasBOQItems = boqItems.some(b => b.project_id === projectId);

    const clientBOQItems = this.get<ClientBOQItem>('client_boq', []);
    const hasClientBOQItems = clientBOQItems.some(c => c.project_id === projectId);

    if (hasBOQItems || hasClientBOQItems) {
      throw new Error("This project cannot be deleted because it contains Bill of Quantities (BOQ) items. Please delete the BOQ items first.");
    }

    this.trackDeletion(projectId);
    this.untrackSyncedId(projectId);
    // Remove project
    const projects = this.getProjects();
    const updatedProjects = projects.filter(p => p.id !== projectId);
    this.save('projects', updatedProjects);

    // Cascading delete
    // 1. BOQ items
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

    // 5. Tasks
    const tasks = this.get<Task>('tasks', []);
    const remainingTasks = tasks.filter(t => t.project_id !== projectId);
    this.save('tasks', remainingTasks);

    if (supabase) {
      supabase.from('projects').delete().eq('id', projectId).then(({ error }) => {
        if (error) console.error('Supabase deleteProject error:', error);
      });
    }

    const deletedProj = projects.find(p => p.id === projectId);
    this.logUserAction(`Deleted project "${deletedProj?.name || projectId}"`);
  }

  // --- Task CRUD ---
  getTasks(projectId?: string): Task[] {
    const tasks = this.get<Task>('tasks', []);
    const filtered = projectId ? tasks.filter(t => t.project_id === projectId) : tasks;
    // Sort by updated_at or created_at descending
    return [...filtered].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  saveTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Task {
    const tasks = this.get<Task>('tasks', []);
    const existing = task.id ? tasks.find(t => t.id === task.id) : null;
    const newTask: Task = {
      ...task,
      id: task.id || generateUUID(),
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const index = tasks.findIndex(t => t.id === newTask.id);
    if (index >= 0) {
      tasks[index] = newTask;
    } else {
      tasks.push(newTask);
    }
    this.save('tasks', tasks);

    this.untrackSyncedId(newTask.id);

    if (supabase) {
      supabase.from('tasks').upsert(newTask).then(({ error }) => {
        if (error) {
          console.error('Supabase saveTask error:', error.message || error, error.details || '');
        } else {
          this.trackSyncedId(newTask.id);
        }
      });
    }

    if (existing) {
      this.logUserAction(`Updated task "${newTask.title}"`, [
        { field: 'status', oldValue: existing.status, newValue: newTask.status },
        { field: 'progress', oldValue: String(existing.progress), newValue: String(newTask.progress) }
      ]);
    } else {
      this.logUserAction(`Created new task "${newTask.title}"`);
    }

    return newTask;
  }

  deleteTask(id: string): void {
    const tasks = this.get<Task>('tasks', []);
    const deletedTask = tasks.find(t => t.id === id);
    const updatedTasks = tasks.filter(t => t.id !== id);
    this.save('tasks', updatedTasks);
    this.trackDeletion(id);
    this.untrackSyncedId(id);

    if (supabase) {
      supabase.from('tasks').delete().eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Supabase deleteTask error:', error.message || error, error.details || '');
        }
      });
    }

    if (deletedTask) {
      this.logUserAction(`Deleted task "${deletedTask.title}"`);
    }
  }

  getTaskMessages(taskId?: string): TaskMessage[] {
    const messages = this.get<TaskMessage>('task_messages', []);
    return taskId ? messages.filter(m => m.task_id === taskId) : messages;
  }

  saveTaskMessage(msg: Partial<TaskMessage>): TaskMessage {
    const messages = this.get<TaskMessage>('task_messages', []);
    const newMsg: TaskMessage = {
      id: msg.id || generateUUID(),
      task_id: msg.task_id || '',
      sender: msg.sender || 'System',
      message: msg.message || '',
      attachment_name: msg.attachment_name || undefined,
      attachment_data: msg.attachment_data || undefined,
      created_at: msg.created_at || new Date().toISOString(),
    };

    const index = messages.findIndex(m => m.id === newMsg.id);
    if (index >= 0) {
      messages[index] = newMsg;
    } else {
      messages.push(newMsg);
    }
    this.save('task_messages', messages);
    this.untrackSyncedId(newMsg.id);

    if (supabase) {
      supabase.from('task_messages').upsert({
        id: newMsg.id,
        task_id: newMsg.task_id,
        sender: newMsg.sender,
        message: newMsg.message,
        attachment_name: newMsg.attachment_name || null,
        attachment_data: newMsg.attachment_data || null,
        created_at: newMsg.created_at
      }).then(({ error }) => {
        if (error) {
          console.error('Supabase saveTaskMessage error:', error.message || error, error.details || '');
        } else {
          this.trackSyncedId(newMsg.id);
        }
      });
    }

    return newMsg;
  }

  deleteTaskMessage(id: string): void {
    const messages = this.get<TaskMessage>('task_messages', []);
    const updated = messages.filter(m => m.id !== id);
    this.save('task_messages', updated);
    this.trackDeletion(id);
    this.untrackSyncedId(id);

    if (supabase) {
      supabase.from('task_messages').delete().eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Supabase deleteTaskMessage error:', error.message || error, error.details || '');
        }
      });
    }
  }

  // --- BOQ CRUD ---
  getBOQItems(projectId?: string): BOQItem[] {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const filtered = projectId ? items.filter(item => item.project_id === projectId) : items;
    return [...filtered].sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  saveBOQItem(item: Omit<BOQItem, 'id' | 'subtotal' | 'created_at'> & { id?: string }): BOQItem {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const existing = item.id ? items.find(i => i.id === item.id) : null;
    const newItem: BOQItem = {
      ...(existing || {}),
      ...item,
      id: item.id || generateUUID(),
      section: item.section || 'General Works',
      sub_section: item.sub_section || 'General',
      client_boq_item_id: item.client_boq_item_id || null,
      client_boq_section: item.client_boq_section || null,
      client_boq_sub_section: item.client_boq_sub_section || null,
      is_manpower_cost: !!item.is_manpower_cost,
      sort_order: item.sort_order ?? 0,
      subtotal: item.approved_qty * item.unit_rate,
      created_at: existing ? existing.created_at : new Date().toISOString()
    } as BOQItem;
    const index = items.findIndex(i => i.id === newItem.id);
    if (index >= 0) {
      items[index] = newItem;
    } else {
      items.push(newItem);
    }
    this.save('boq', items);

    this.untrackSyncedId(newItem.id);

    if (supabase) {
      const client = supabase;
      const {
        subtotal,
        client_item_code,
        ordered_qty,
        received_qty,
        consumed_qty,
        wastage_qty,
        stock_balance,
        boq_balance,
        ...supabaseItem
      } = newItem as any;
      safeUpsert('boq_items', supabaseItem).then(({ error }) => {
        if (error) {
          console.error('Supabase saveBOQItem error:', error);
        } else {
          this.trackSyncedId(newItem.id);
        }
      });
    }

    return newItem;
  }

  deleteBOQItem(itemId: string): void {
    const poLines = this.get<PurchaseOrderLine>('po_lines', []);
    const isReferenced = poLines.some(line => line.boq_item_id === itemId);
    if (isReferenced) {
      throw new Error("This BOQ item cannot be deleted because it is already referenced in one or more Purchase Orders. Please delete those Purchase Order lines first.");
    }

    this.trackDeletion(itemId);
    this.untrackSyncedId(itemId);
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updated = items.filter(i => i.id !== itemId);
    this.save('boq', updated);

    // Delete any linked client mapping records if it's a manpower item
    const links = this.get<InternalManpowerClientLink>('internal_manpower_client_links', []);
    const relatedLinks = links.filter(l => l.internal_boq_item_id === itemId);
    relatedLinks.forEach(l => {
      this.trackDeletion(l.id);
      this.untrackSyncedId(l.id);
      if (supabase) {
        supabase.from('internal_manpower_client_links').delete().eq('id', l.id).then(({ error }) => {
          if (error) console.error('Supabase delete link error:', error);
        });
      }
    });
    this.save('internal_manpower_client_links', links.filter(l => l.internal_boq_item_id !== itemId));

    if (supabase) {
      supabase.from('boq_items').delete().eq('id', itemId).then(({ error }) => {
        if (error) console.error('Supabase deleteBOQItem error:', error);
      });
    }
  }

  getManpowerLinks(internalBoqItemId?: string): InternalManpowerClientLink[] {
    const links = this.get<InternalManpowerClientLink>('internal_manpower_client_links', []);
    return internalBoqItemId ? links.filter(l => l.internal_boq_item_id === internalBoqItemId) : links;
  }

  saveManpowerLinksForInternalItem(internalBoqItemId: string, clientBoqItemIds: string[]): void {
    let links = this.get<InternalManpowerClientLink>('internal_manpower_client_links', []);

    // Remove existing links for this internal item
    const existingForThisItem = links.filter(l => l.internal_boq_item_id === internalBoqItemId);
    existingForThisItem.forEach(l => {
      this.trackDeletion(l.id);
      this.untrackSyncedId(l.id);
      if (supabase) {
        supabase.from('internal_manpower_client_links').delete().eq('id', l.id).then(({ error }) => {
          if (error) console.error('Supabase delete link error:', error);
        });
      }
    });

    links = links.filter(l => l.internal_boq_item_id !== internalBoqItemId);

    // Calculate total client value of linked client items
    let totalClientValue = 0;
    clientBoqItemIds.forEach(clientId => {
      const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === clientId);
      if (clientItem) {
        totalClientValue += clientItem.value;
      }
    });

    // Add new links
    clientBoqItemIds.forEach(clientId => {
      const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === clientId);
      let weight = 100.00;
      if (clientItem && totalClientValue > 0) {
        weight = (clientItem.value / totalClientValue) * 100;
      }

      const newLink: InternalManpowerClientLink = {
        id: generateUUID(),
        internal_boq_item_id: internalBoqItemId,
        client_boq_item_id: clientId,
        allocation_weight: weight,
        created_at: new Date().toISOString()
      };
      links.push(newLink);

      this.untrackSyncedId(newLink.id);
      if (supabase) {
        supabase.from('internal_manpower_client_links')
          .upsert(newLink, { onConflict: 'internal_boq_item_id,client_boq_item_id' })
          .then(({ error }) => {
            if (error) {
              console.error('Supabase saveManpowerLink error details - message:', error.message, 'code:', error.code, 'details:', error.details, 'hint:', error.hint);
            } else {
              this.trackSyncedId(newLink.id);
            }
          });
      }
    });

    this.save('internal_manpower_client_links', links);
  }

  getClientBOQProgressPercent(clientBOQItemId: string, asOfDate?: string): number {
    const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === clientBOQItemId);
    if (!clientItem) return 0;

    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    // Find all NON-manpower internal items mapped to this client item
    const mappedInternals = items.filter(i => {
      if (i.is_manpower_cost) return false; // MUST EXCLUDE MANPOWER ITEMS to avoid circular dependency
      if (i.client_boq_item_id === clientItem.id) return true;
      if (i.client_boq_item_id) return false;
      if (i.client_boq_section === clientItem.section && clientItem.section) {
        if (i.client_boq_sub_section) {
          return i.client_boq_sub_section === clientItem.sub_section;
        }
        return true;
      }
      return false;
    });

    const totalInternalValue = mappedInternals.reduce((sum, i) => sum + (i.approved_qty * i.unit_rate), 0);

    let executedValue = 0;
    mappedInternals.forEach(i => {
      executedValue += this.getBOQExecutedValue(i.id, asOfDate);
    });

    return totalInternalValue > 0 ? (executedValue / totalInternalValue) * 100 : 0;
  }

  bulkLinkBOQItems(itemIds: string[], clientBOQItemId: string | null, clientBOQSection: string | null = null, clientBOQSubSection: string | null = null): void {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updatedItems: BOQItem[] = items.map(item => {
      if (!itemIds.includes(item.id)) return item;
      return {
        ...item,
        client_boq_item_id: clientBOQItemId,
        client_boq_section: clientBOQSection,
        client_boq_sub_section: clientBOQSubSection
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
          client_boq_section: i.client_boq_section || null,
          client_boq_sub_section: i.client_boq_sub_section || null
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

  saveBOQItemsOrder(itemsToUpdate: { id: string; sort_order: number }[]): void {
    const items = this.get<BOQItem>('boq', INITIAL_BOQ);
    const updateMap = new Map(itemsToUpdate.map(i => [i.id, i.sort_order]));
    const updated = items.map(item => {
      if (updateMap.has(item.id)) {
        return { ...item, sort_order: updateMap.get(item.id)! };
      }
      return item;
    });
    this.save('boq', updated);

    itemsToUpdate.forEach(i => this.untrackSyncedId(i.id));

    if (supabase) {
      const client = supabase;
      const toUpsert = updated
        .filter(i => updateMap.has(i.id))
        .map(i => {
          const {
            subtotal,
            client_item_code,
            ordered_qty,
            received_qty,
            consumed_qty,
            wastage_qty,
            stock_balance,
            boq_balance,
            ...supabaseItem
          } = i as any;
          return supabaseItem;
        });
      safeUpsert('boq_items', toUpsert).then(({ error }) => {
        if (error) {
          console.error('Supabase saveBOQItemsOrder error:', error);
        } else {
          itemsToUpdate.forEach(i => this.trackSyncedId(i.id));
        }
      });
    }
  }

  saveClientBOQItemsOrder(itemsToUpdate: { id: string; sort_order: number }[]): void {
    const items = this.get<ClientBOQItem>('client_boq', []);
    const updateMap = new Map(itemsToUpdate.map(i => [i.id, i.sort_order]));
    const updated = items.map(item => {
      if (updateMap.has(item.id)) {
        return { ...item, sort_order: updateMap.get(item.id)! };
      }
      return item;
    });
    this.save('client_boq', updated);

    itemsToUpdate.forEach(i => this.untrackSyncedId(i.id));

    if (supabase) {
      const client = supabase;
      const toUpsert = updated
        .filter(i => updateMap.has(i.id))
        .map(newItem => ({
          id: newItem.id,
          project_id: newItem.project_id,
          item_code: newItem.item_code,
          description: newItem.description,
          value: newItem.value ?? 0,
          section: newItem.section || null,
          sub_section: newItem.sub_section || null,
          unit: newItem.unit || null,
          qty: newItem.qty ?? null,
          unit_rate: newItem.unit_rate ?? null,
          sort_order: newItem.sort_order ?? 0,
          created_at: newItem.created_at
        }));
      client.from('client_boq_items').upsert(toUpsert).then(({ error }) => {
        if (error) {
          console.warn('Supabase saveClientBOQItemsOrder failed, retrying without rate:', error);
          const fallbackUpsert = toUpsert.map(({ unit_rate, ...rest }) => rest);
          client.from('client_boq_items').upsert(fallbackUpsert).then(({ error: err2 }) => {
            if (err2) {
              console.warn('Supabase saveClientBOQItemsOrder fallback failed, retrying without sort_order:', err2);
              const fallbackUpsert2 = fallbackUpsert.map(({ sort_order, ...rest }) => rest);
              client.from('client_boq_items').upsert(fallbackUpsert2).then(({ error: err3 }) => {
                if (err3) console.error('Supabase saveClientBOQItemsOrder final error:', err3);
                else itemsToUpdate.forEach(i => this.trackSyncedId(i.id));
              });
            } else {
              itemsToUpdate.forEach(i => this.trackSyncedId(i.id));
            }
          });
        } else {
          itemsToUpdate.forEach(i => this.trackSyncedId(i.id));
        }
      });
    }
  }

  // --- Client BOQ CRUD ---

  getClientBOQItems(projectId?: string): ClientBOQItem[] {
    const items = this.get<ClientBOQItem>('client_boq', []);
    const filtered = projectId ? items.filter(item => item.project_id === projectId) : items;
    return [...filtered].sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  saveClientBOQItem(item: Omit<ClientBOQItem, 'id' | 'created_at'> & { id?: string }): ClientBOQItem {
    const items = this.get<ClientBOQItem>('client_boq', []);
    const newItem: ClientBOQItem = {
      ...item,
      id: item.id || generateUUID(),
      section: item.section || 'General',
      sub_section: item.sub_section || 'General',
      unit: item.unit || 'LS',
      qty: item.qty !== undefined && item.qty !== null ? item.qty : 1.000,
      unit_rate: item.unit_rate !== undefined && item.unit_rate !== null ? item.unit_rate : 0,
      sort_order: item.sort_order ?? 0,
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
        sub_section: newItem.sub_section || null,
        unit: newItem.unit || null,
        qty: newItem.qty ?? null,
        unit_rate: newItem.unit_rate ?? null,
        sort_order: newItem.sort_order ?? 0,
        created_at: newItem.created_at
      };

      safeUpsert('client_boq_items', dbPayload).then(({ error }) => {
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
    const boqItem = this.get<BOQItem>('boq', []).find(b => b.id === boqItemId);
    if (!boqItem) return 0;

    // Dynamic execution progress based on linked client BOQ items if designated as manpower
    if (boqItem.is_manpower_cost) {
      const links = this.getManpowerLinks(boqItemId);
      if (links.length === 0) return 0;

      let totalWeight = 0;
      let weightedProgressSum = 0;

      links.forEach(link => {
        const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === link.client_boq_item_id);
        if (clientItem) {
          const progressPercent = this.getClientBOQProgressPercent(clientItem.id, asOfDate);
          const weight = link.allocation_weight ?? 100.00;
          totalWeight += weight;
          weightedProgressSum += progressPercent * weight;
        }
      });

      const averageProgress = totalWeight > 0 ? (weightedProgressSum / totalWeight) : 0;
      const totalManpowerValue = boqItem.approved_qty * boqItem.unit_rate;
      return totalManpowerValue * (averageProgress / 100);
    }

    const issues = this.get<MaterialIssue>('material_issues', []);
    const issueLines = this.get<IssueLine>('issue_lines', []);

    const filteredIssues = asOfDate
      ? issues.filter(i => new Date(i.issue_date) <= new Date(asOfDate))
      : issues;

    const issueIds = new Set(filteredIssues.map(i => i.id));
    const lines = issueLines.filter(l => l.boq_item_id === boqItemId && issueIds.has(l.issue_id));

    const qty = lines.reduce((sum, l) => sum + l.qty_issued + l.qty_wastage, 0);
    const rate = boqItem.unit_rate;

    return qty * rate;
  }

  // --- Suppliers CRUD ---
  getSuppliers(): Supplier[] {
    return this.get<Supplier>('suppliers', INITIAL_SUPPLIERS);
  }

  saveSupplier(supplier: Omit<Supplier, 'id' | 'created_at'> & { id?: string }, skipAutoSync = false): Supplier {
    const suppliers = this.getSuppliers();
    const existing = supplier.id ? suppliers.find(s => s.id === supplier.id) : null;
    const newSupplier: Supplier = {
      ...(existing || {}),
      ...supplier,
      id: supplier.id || generateUUID(),
      created_at: existing ? existing.created_at : new Date().toISOString()
    } as Supplier;
    const index = suppliers.findIndex(s => s.id === newSupplier.id);

    if (index >= 0) {
      suppliers[index] = newSupplier;
    } else {
      suppliers.push(newSupplier);
    }
    this.save('suppliers', suppliers);
    this.untrackSyncedId(newSupplier.id);

    if (supabase) {
      const { tin_number, ...supabasePayload } = newSupplier as any;
      supabase.from('suppliers').upsert(supabasePayload).then(({ error }) => {
        if (error) {
          console.error('Supabase saveSupplier error:', error.message, 'Code:', error.code, 'Details:', error.details, 'Hint:', error.hint);
        } else {
          this.trackSyncedId(newSupplier.id);
        }
      });
    }

    if (existing) {
      this.logUserAction(`Updated details for supplier "${newSupplier.name}"`, [
        { field: 'contact_person', oldValue: existing.contact_person, newValue: newSupplier.contact_person },
        { field: 'email', oldValue: existing.email, newValue: newSupplier.email },
        { field: 'phone', oldValue: existing.phone, newValue: newSupplier.phone },
        { field: 'address', oldValue: existing.address || '', newValue: newSupplier.address || '' }
      ]);
    } else {
      this.logUserAction(`Created new supplier "${newSupplier.name}"`);
    }

    // Trigger auto sync to Zoho Books if connected
    if (!skipAutoSync) {
      const settings = this.getZohoSettings();
      if (settings.refreshToken) {
        import('./zoho').then(({ zohoClient }) => {
          zohoClient.syncSupplier(newSupplier.id).catch(err => {
            console.error('Auto-sync supplier failed:', err.message || err);
          });
        });
      }
    }

    return newSupplier;
  }

  deleteSupplier(id: string): void {
    const suppliers = this.getSuppliers();
    const deletedSupplier = suppliers.find(s => s.id === id);

    this.trackDeletion(id);
    this.untrackSyncedId(id);
    const updatedSuppliers = suppliers.filter(s => s.id !== id);
    this.save('suppliers', updatedSuppliers);

    if (supabase) {
      supabase.from('suppliers').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteSupplier error:', error);
      });
    }

    this.logUserAction(`Deleted supplier "${deletedSupplier?.name || id}"`);
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
    lines: Omit<PurchaseOrderLine, 'id' | 'po_id' | 'created_at'>[],
    skipAutoSync = false
  ): PurchaseOrder {
    const pos = this.getPOs();
    const allLines = this.get<PurchaseOrderLine>('po_lines', []);
    const existing = po.id ? pos.find(p => p.id === po.id) : null;

    const newPO: PurchaseOrder = {
      ...(existing || {}),
      ...po,
      supplier_id: po.supplier_id || null,
      id: po.id || generateUUID(),
      created_at: existing ? existing.created_at : new Date().toISOString()
    } as PurchaseOrder;

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
        if (delErr) console.error('Supabase savePO lines delete error:', delErr.message || delErr.details || delErr);
        client.from('purchase_orders').upsert(newPO).then(({ error: poErr }) => {
          if (poErr) {
            console.error('Supabase savePO upsert error:', poErr.message || poErr.details || poErr);
          } else {
            this.trackSyncedId(newPO.id);
          }
          client.from('purchase_order_lines').insert(newLines).then(({ error: insErr }) => {
            if (insErr) {
              console.error('Supabase savePO lines insert error:', insErr.message || insErr.details || insErr, '\nReminder: If you added a new column like "supplier_description", make sure to run the SQL migration on your Supabase SQL Editor.');
            } else {
              newLines.forEach(line => this.trackSyncedId(line.id));
            }
          });
        });
      });
    }

    if (existing) {
      this.logUserAction(`Updated Purchase Order "${newPO.po_number}" - "${newPO.description}"`);
    } else {
      this.logUserAction(`Created new Purchase Order "${newPO.po_number}" - "${newPO.description}"`);
    }

    // Trigger auto sync to Zoho Books if connected
    if (!skipAutoSync && newPO.supplier_id) {
      const settings = this.getZohoSettings();
      if (settings.refreshToken) {
        import('./zoho').then(({ zohoClient }) => {
          zohoClient.syncPurchaseOrder(newPO.id).catch(err => {
            console.error('Auto-sync PO failed:', err.message || err);
          });
        });
      }
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
    const grns = this.get<any>('grns', []);
    const grnLines = this.get<any>('grn_lines', []);
    const associatedGrns = grns.filter((g: any) => g.po_id === poId);
    if (associatedGrns.length > 0) {
      throw new Error("This Purchase Order cannot be deleted because items have already been received at the site. Please delete the associated Goods Receipt Notes first.");
    }

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
    const grnsToDelete = grns.filter((g: any) => g.po_id === poId);
    const grnIdsToDelete = new Set(grnsToDelete.map((g: any) => g.id));
    const updatedGrns = grns.filter((g: any) => g.po_id !== poId);
    const updatedGrnLines = grnLines.filter((l: any) => !grnIdsToDelete.has(l.grn_id));

    grnsToDelete.forEach((g: any) => {
      this.untrackSyncedId(g.id);
      const gls = grnLines.filter((gl: any) => gl.grn_id === g.id);
      gls.forEach((gl: any) => this.untrackSyncedId(gl.id));
    });

    const deletedPo = pos.find(p => p.id === poId);

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

    if (deletedPo) {
      this.logUserAction(`Deleted Purchase Order "${deletedPo.po_number}" - "${deletedPo.description}"`);
      
      // Void the PO in Zoho Books if synced
      if (deletedPo.zoho_po_id) {
        const zohoPoId = deletedPo.zoho_po_id;
        const settings = this.getZohoSettings();
        if (settings.refreshToken) {
          import('./zoho').then(({ zohoClient }) => {
            zohoClient.voidPurchaseOrder(zohoPoId).catch(err => {
              console.error('Failed to void PO in Zoho:', err.message || err);
            });
          });
        }
      }
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
      id: grn.id || generateUUID(),
      grn_number: grn.grn_number,
      po_id: grn.po_id,
      project_id: grn.project_id,
      received_date: grn.received_date,
      received_by: grn.received_by,
      delivery_note_number: grn.delivery_note_number,
      do_copy: grn.do_copy,
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

    // Retrieve PO type
    const pos = this.getPOs();
    const po = pos.find(p => p.id === grn.po_id);
    const isSubcontract = po?.type === 'subcontract';
    const poLines = this.getPOLines(grn.po_id);

    const boqItems = this.getBOQItems(grn.project_id);

    // Add lines
    const newLines = lines.map((line) => {
      let qty_received = line.qty_received;
      let amount_received = line.amount_received ?? 0;

      const poLine = poLines.find(pl => pl.id === line.po_line_id);
      let isLumpSum = false;
      if (poLine && poLine.boq_item_id) {
        const matchingBOQ = boqItems.find(b => b.id === poLine.boq_item_id);
        if (matchingBOQ) {
          const u = matchingBOQ.unit.trim().toUpperCase();
          isLumpSum = u === 'LS' || u === 'L.S' || u === 'LUMPSUM' || u === 'LUMP SUM' || u === 'ITEM';
        }
      }

      if (isSubcontract && isLumpSum) {
        if (poLine && poLine.unit_rate > 0) {
          qty_received = amount_received / poLine.unit_rate;
        } else {
          qty_received = 0;
        }
      } else {
        amount_received = qty_received * (poLine?.unit_rate ?? 0);
      }

      return {
        id: generateUUID(),
        grn_id: newGRN.id,
        po_line_id: line.po_line_id,
        qty_received,
        amount_received,
        created_at: new Date().toISOString()
      };
    });
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
              console.error('Supabase saveGRN edit error:', grnErr.message, grnErr.details, grnErr.hint, grnErr.code);
            } else {
              this.trackSyncedId(newGRN.id);
            }
            client.from('grn_lines').insert(newLines).then(({ error: linesErr }) => {
              if (linesErr) {
                console.warn('Supabase saveGRN edit lines insert failed, retrying without amount_received:', linesErr);
                const fallbackLines = newLines.map(({ amount_received, ...rest }) => rest);
                client.from('grn_lines').insert(fallbackLines).then(({ error: err2 }) => {
                  if (err2) console.error('Supabase saveGRN edit fallback lines error:', err2.message, err2.details, err2.hint);
                  else newLines.forEach(line => this.trackSyncedId(line.id));
                });
              } else {
                newLines.forEach(line => this.trackSyncedId(line.id));
              }
            });
          });
        });
      } else {
        client.from('goods_receipt_notes').insert(newGRN).then(({ error: grnErr }) => {
          if (grnErr) {
            console.error('Supabase saveGRN error:', grnErr.message, grnErr.details, grnErr.hint, grnErr.code);
          } else {
            this.trackSyncedId(newGRN.id);
          }
          client.from('grn_lines').insert(newLines).then(({ error: linesErr }) => {
            if (linesErr) {
              console.warn('Supabase saveGRN lines insert failed, retrying without amount_received:', linesErr);
              const fallbackLines = newLines.map(({ amount_received, ...rest }) => rest);
              client.from('grn_lines').insert(fallbackLines).then(({ error: err2 }) => {
                if (err2) console.error('Supabase saveGRN fallback lines error:', err2.message, err2.details, err2.hint);
                else newLines.forEach(line => this.trackSyncedId(line.id));
              });
            } else {
              newLines.forEach(line => this.trackSyncedId(line.id));
            }
          });
        });
      }
    }

    if (isEdit) {
      this.logUserAction(`Updated Goods Receipt Note (GRN) "${newGRN.grn_number}"`);
    } else {
      this.logUserAction(`Created new Goods Receipt Note (GRN) "${newGRN.grn_number}"`);
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
    this.logUserAction(`Created new Material Issue Note (MIN) "${newIssue.issue_number}"`);

    return newIssue;
  }

  deleteGRN(grnId: string): void {
    const grns = this.get<GoodsReceiptNote>('grns', []);
    const grn = grns.find(g => g.id === grnId);
    if (!grn) return;

    // Find all BOQ item IDs received in this GRN
    const allPOLines = this.get<PurchaseOrderLine>('po_lines', []);
    const allGRNLines = this.get<GRNLine>('grn_lines', []);
    const grnLinesForThisGRN = allGRNLines.filter(l => l.grn_id === grnId);

    const receivedBOQItemIds = new Set<string>();
    grnLinesForThisGRN.forEach(gl => {
      const poLine = allPOLines.find(pl => pl.id === gl.po_line_id);
      if (poLine && poLine.boq_item_id) {
        receivedBOQItemIds.add(poLine.boq_item_id);
      }
    });

    // Check if any of these BOQ item IDs have been issued in the project
    if (receivedBOQItemIds.size > 0) {
      const allIssues = this.get<MaterialIssue>('material_issues', []);
      const projectIssues = allIssues.filter(i => i.project_id === grn.project_id);
      const allIssueLines = this.get<IssueLine>('issue_lines', []);

      const hasMINBooked = allIssueLines.some(il =>
        receivedBOQItemIds.has(il.boq_item_id) &&
        projectIssues.some(pi => pi.id === il.issue_id) &&
        (il.qty_issued > 0 || il.qty_wastage > 0)
      );

      if (hasMINBooked) {
        throw new Error(`This Goods Receipt Note (GRN) "${grn.grn_number}" cannot be deleted because the received materials have already been booked/issued under one or more Material Issue Notes (MIN). Please delete the associated MINs first.`);
      }
    }

    this.trackDeletion(grnId);
    this.untrackSyncedId(grnId);

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

    if (grn) {
      this.logUserAction(`Deleted Goods Receipt Note (GRN) "${grn.grn_number}"`);
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

    const deletedIssue = issues.find(i => i.id === issueId);

    const client = supabase;
    if (client) {
      client.from('material_issues').delete().eq('id', issueId).then(({ error }) => {
        if (error) console.error('Supabase deleteMaterialIssue error:', error);
      });
    }

    if (deletedIssue) {
      this.logUserAction(`Deleted Material Issue Note (MIN) "${deletedIssue.issue_number}"`);
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

  getCostVariationReport(projectId: string) {
    const project = this.getProjects().find(p => p.id === projectId);
    const isApproved = !!project?.boq_approved;

    const boqItems = this.getBOQItems(projectId);
    const pos = this.getPOs(projectId).filter(po => po.status !== 'draft');
    const allPOLines = this.get<PurchaseOrderLine>('po_lines', []);

    return boqItems.map(item => {
      const poLines = allPOLines.filter(
        pol => pol.boq_item_id === item.id && pos.some(po => po.id === pol.po_id)
      );

      const totalOrderedQty = poLines.reduce((sum, pol) => sum + pol.qty, 0);
      const totalOrderedAmount = poLines.reduce((sum, pol) => sum + pol.qty * pol.unit_rate, 0);

      // Baseline quantity and rate depend on approval state
      const baselineQty = isApproved ? (item.frozen_qty ?? item.approved_qty) : item.approved_qty;
      const baselineRate = isApproved ? (item.frozen_rate ?? item.unit_rate) : item.unit_rate;
      const boqTotal = baselineQty * baselineRate;

      const avgPurchaseRate = totalOrderedQty > 0 ? totalOrderedAmount / totalOrderedQty : 0;
      
      // Check if we should skip quantity variance calculation (due to breakups, lump sum, or unit changes)
      const hasMultipleLines = poLines.length > 1;
      const isLumpSum = baselineQty === 1 || (item.unit && item.unit.toLowerCase() === 'ls');
      const hasDifferentUnits = poLines.some(pol => pol.unit && pol.unit !== item.unit);
      const skipQtyVariance = hasMultipleLines || isLumpSum || hasDifferentUnits;

      let priceVariance = 0;
      let qtyVariance = 0;
      let varianceQty = 0;
      let rateVariance = 0;
      let variancePercent = 0;
      let displayOrderedQty = totalOrderedQty;

      if (skipQtyVariance) {
        // For breakups/Lump Sum, the purchase quantity is determined by the percentage of value ordered relative to approved value
        displayOrderedQty = boqTotal > 0 ? (totalOrderedAmount / boqTotal) * baselineQty : 0;
        qtyVariance = (displayOrderedQty - baselineQty) * baselineRate;
        varianceQty = displayOrderedQty - baselineQty;
        priceVariance = 0;
        rateVariance = 0;
        variancePercent = 0;
      } else {
        priceVariance = totalOrderedQty * (avgPurchaseRate - baselineRate);
        qtyVariance = (totalOrderedQty - baselineQty) * baselineRate;
        varianceQty = totalOrderedQty - baselineQty;
        rateVariance = totalOrderedQty > 0 ? avgPurchaseRate - baselineRate : 0;
        variancePercent = baselineRate > 0 ? (rateVariance / baselineRate) * 100 : 0;
      }
      
      // Total Cost Variance = Purchased Cost - BOQ Budget
      const totalCostVariance = totalOrderedAmount - boqTotal;

      return {
        ...item,
        approved_qty: baselineQty,
        unit_rate: baselineRate,
        ordered_qty: displayOrderedQty,
        avg_purchase_rate: skipQtyVariance ? 0 : avgPurchaseRate,
        rate_variance: rateVariance,
        variance_percent: variancePercent,
        variance_qty: varianceQty,
        variance_rate: rateVariance,
        price_variance: priceVariance,
        qty_variance: qtyVariance,
        total_cost_variance: totalCostVariance,
        ordered_total: totalOrderedAmount
      };
    });
  }

  approveBOQ(projectId: string, username: string): boolean {
    const projects = this.getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return false;

    const updatedProject = {
      ...projects[projectIndex],
      boq_approved: true,
      boq_approved_by: username,
      boq_approved_at: new Date().toISOString()
    };
    projects[projectIndex] = updatedProject;
    this.save('projects', projects);

    const boqs = this.get<BOQItem>('boq', []);
    const projectBoqItems: BOQItem[] = [];
    const updatedBoqs = boqs.map(item => {
      if (item.project_id === projectId) {
        const updated = {
          ...item,
          frozen_qty: item.approved_qty,
          frozen_rate: item.unit_rate
        };
        projectBoqItems.push(updated);
        return updated;
      }
      return item;
    });
    this.save('boq', updatedBoqs);

    // Track for Supabase sync
    this.untrackSyncedId(projectId);
    projectBoqItems.forEach(item => this.untrackSyncedId(item.id));

    if (supabase) {
      supabase.from('projects').upsert(updatedProject).then(({ error }) => {
        if (error) console.error('Supabase approveBOQ project error:', error);
        else this.trackSyncedId(projectId);
      });
      supabase.from('boq_items').upsert(projectBoqItems).then(({ error }) => {
        if (error) console.error('Supabase approveBOQ items error:', error);
        else projectBoqItems.forEach(item => this.trackSyncedId(item.id));
      });
    }

    return true;
  }

  undoApproveBOQ(projectId: string, username: string): boolean {
    if (username.toLowerCase() !== 'kumaresan') {
      throw new Error('Only user kumaresan is authorized to undo BOQ approval.');
    }

    const projects = this.getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return false;

    const updatedProject = {
      ...projects[projectIndex],
      boq_approved: false,
      boq_approved_by: undefined,
      boq_approved_at: undefined
    };
    projects[projectIndex] = updatedProject;
    this.save('projects', projects);

    const boqs = this.get<BOQItem>('boq', []);
    const projectBoqItems: BOQItem[] = [];
    const updatedBoqs = boqs.map(item => {
      if (item.project_id === projectId) {
        const updated = {
          ...item,
          frozen_qty: null,
          frozen_rate: null
        };
        projectBoqItems.push(updated);
        return updated;
      }
      return item;
    });
    this.save('boq', updatedBoqs);

    // Track for Supabase sync
    this.untrackSyncedId(projectId);
    projectBoqItems.forEach(item => this.untrackSyncedId(item.id));

    if (supabase) {
      supabase.from('projects').upsert(updatedProject).then(({ error }) => {
        if (error) console.error('Supabase undoApproveBOQ project error:', error);
        else this.trackSyncedId(projectId);
      });
      supabase.from('boq_items').upsert(projectBoqItems).then(({ error }) => {
        if (error) console.error('Supabase undoApproveBOQ items error:', error);
        else projectBoqItems.forEach(item => this.trackSyncedId(item.id));
      });
    }

    return true;
  }

  uploadSignedBOQ(projectId: string, filename: string | null, fileData: string | null): boolean {
    const projects = this.getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return false;

    projects[projectIndex] = {
      ...projects[projectIndex],
      signed_boq_copy: fileData,
      signed_boq_name: filename
    };
    this.save('projects', projects);
    return true;
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
      let localItems = this.get<T>(key, initial).map(normalizeItem);
      const { data: dbItems, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`Supabase Sync Warning: Table "${tableName}" could not be fetched (it may not exist or lacks permissions). Local data will be used. Error message: ${JSON.stringify(error)}`);
        return;
      }
      const normalizedDbItems = (dbItems || []).map(normalizeItem);

      // Track deleted records to prevent deleted records from coming back
      const deletedIds = this.get<string>('deleted_ids', []);
      const deletedSet = new Set(deletedIds);

      // 1. Process deletions on Supabase for any locally deleted items
      const dbItemsToKeep = [];
      for (const dbItem of normalizedDbItems) {
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
      const unsyncedIds = this.getUnsyncedIds();

      const itemsToUpsertToDB: T[] = [];
      const finalLocalItems: T[] = [];

      // 2. Compare matching items and detect unsynced updates
      for (const localItem of localItems) {
        const dbItem = dbMap.get(localItem.id);
        if (!dbItem) {
          // Exists locally but not in DB.
          // If the item ID is in unsyncedIds, it is a new local item that needs to be uploaded.
          // Otherwise, it was deleted on Supabase, so we discard it.
          if (unsyncedIds.has(localItem.id)) {
            itemsToUpsertToDB.push(localItem);
            finalLocalItems.push(localItem);
          }
        } else {
          // Exists in both -> Check if local has updates.
          const cleanLocal = cleanPayload ? cleanPayload(localItem) : localItem;
          const cleanDb = cleanPayload ? cleanPayload(dbItem as any) : dbItem;

          if (canonicalStringify(cleanLocal) !== canonicalStringify(cleanDb)) {
            if (unsyncedIds.has(localItem.id)) {
              // Local has unsynced changes -> upload to DB
              itemsToUpsertToDB.push(localItem);
              finalLocalItems.push(localItem);
            } else {
              // DB has updates from another system -> accept DB version
              finalLocalItems.push(dbItem as any);
            }
          } else {
            finalLocalItems.push(dbItem as any);
          }
        }
      }

      // 3. Add items that exist in DB but not locally (and are not deleted)
      for (const dbItem of dbItemsToKeep) {
        if (!localMap.has(dbItem.id)) {
          finalLocalItems.push(dbItem);
        }
      }

      // Ensure itemsToUpsertToDB contains unique items by ID to prevent ON CONFLICT DO UPDATE errors in Supabase
      const uniqueUpsertMap = new Map<string, T>();
      for (const item of itemsToUpsertToDB) {
        uniqueUpsertMap.set(item.id, item);
      }
      const deduplicatedUpsertItems = Array.from(uniqueUpsertMap.values());

      // Ensure finalLocalItems has no duplicates by ID
      const uniqueLocalMap = new Map<string, T>();
      for (const item of finalLocalItems) {
        uniqueLocalMap.set(item.id, item);
      }
      const deduplicatedLocalItems = Array.from(uniqueLocalMap.values());

      // 4. Upload unsynced items to Supabase
      if (deduplicatedUpsertItems.length > 0) {
        const payloads = cleanPayload
          ? deduplicatedUpsertItems.map(cleanPayload)
          : deduplicatedUpsertItems;

        let currentPayloads = payloads;
        const { error: uploadError } = await supabase.from(tableName).upsert(currentPayloads);
        let currentError: any = uploadError;
        let retryCount = 0;

        while (currentError && (currentError.code === 'PGRST204' || currentError.message?.includes('PGRST204')) && retryCount < 5) {
          const match = currentError.message?.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const missingColumn = match[1];
            console.warn(`Column '${missingColumn}' is missing on Supabase for table '${tableName}'. Stripping column and retrying...`);
            currentPayloads = currentPayloads.map((p: any) => {
              const { [missingColumn]: _, ...rest } = p;
              return rest;
            });
            retryCount++;
            const { error: retryErr } = await supabase.from(tableName).upsert(currentPayloads);
            currentError = retryErr;
          } else {
            break;
          }
        }

        if (currentError) {
          console.error(`Error uploading unsynced ${tableName} to Supabase: Code: ${currentError.code} | Message: ${currentError.message}`, currentError);
        } else {
          // Successfully uploaded -> track as synced (remove from unsyncedIds)
          deduplicatedUpsertItems.forEach(item => this.trackSyncedId(item.id));
        }
      }

      // 5. Save final merged list to local storage
      this.save(key, deduplicatedLocalItems);
    } catch (e) {
      console.error(`Failed to sync table ${tableName}:`, e);
    }
  }

  async syncFromSupabase(): Promise<void> {
    if (!supabase) return;

    await this.syncTable<Project>('projects', 'projects', INITIAL_PROJECTS, (item: any) => {
      const { tin_number, ...payload } = item;
      if (item.tin_number && !item.cr_number) {
        payload.cr_number = item.tin_number;
      }
      return payload;
    });
    await this.syncTable<BOQItem>('boq', 'boq_items', INITIAL_BOQ, (item) => {
      const {
        subtotal,
        client_item_code,
        ordered_qty,
        received_qty,
        consumed_qty,
        wastage_qty,
        stock_balance,
        boq_balance,
        ...payload
      } = item as any;
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
      if (payload.supplier_id === '') {
        payload.supplier_id = null;
      }
      return payload;
    });
    await this.syncTable<any>('po_lines', 'purchase_order_lines', [], (item: any) => {
      // Strip any client-side computed fields; ensure boq_item_id can be null
      return {
        id: item.id,
        po_id: item.po_id,
        boq_item_id: item.boq_item_id || null,
        description: item.description,
        supplier_description: item.supplier_description || null,
        qty: item.qty,
        unit_rate: item.unit_rate,
        vat_rate: item.vat_rate,
        created_at: item.created_at
      };
    });

    // Self-healing: Clean up orphaned local GRNs referencing non-existent POs
    // (after pos has synced), and orphaned GRN lines referencing non-existent GRNs or non-existent PO lines.
    const localPos = this.get<any>('pos', []);
    const poIds = new Set(localPos.map((po: any) => po.id));
    const localPoLines = this.get<any>('po_lines', []);
    const poLineIds = new Set(localPoLines.map((pol: any) => pol.id));

    const localGrns = this.get<any>('grns', []);
    const orphanedGrns = localGrns.filter((g: any) => !poIds.has(g.po_id));
    if (orphanedGrns.length > 0) {
      console.log(`Cleaning up ${orphanedGrns.length} orphaned GRNs from local storage.`);
    }
    const activeGrns = localGrns.filter((g: any) => poIds.has(g.po_id));
    this.save('grns', activeGrns);
    const activeGrnIds = new Set(activeGrns.map((g: any) => g.id));

    const localGrnLines = this.get<any>('grn_lines', []);
    const activeGrnLines = localGrnLines.filter((l: any) => activeGrnIds.has(l.grn_id) && poLineIds.has(l.po_line_id));
    const orphanedGrnLinesCount = localGrnLines.length - activeGrnLines.length;
    if (orphanedGrnLinesCount > 0) {
      console.log(`Cleaning up ${orphanedGrnLinesCount} orphaned GRN lines from local storage.`);
    }
    this.save('grn_lines', activeGrnLines);

    await this.syncTable<any>('grns', 'goods_receipt_notes', [], (item: any) => {
      return {
        id: item.id,
        grn_number: item.grn_number,
        po_id: item.po_id,
        project_id: item.project_id,
        received_date: item.received_date,
        received_by: item.received_by,
        delivery_note_number: item.delivery_note_number || null,
        do_copy: item.do_copy || null,
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
        boq_item_id: item.boq_item_id,
        qty_issued: item.qty_issued,
        qty_wastage: item.qty_wastage ?? 0,
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
        unit_rate: item.unit_rate ?? null,
        value: item.value ?? 0,
        section: item.section || null,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('client_claims', 'client_claims', []);
    await this.syncTable<any>('client_claim_lines', 'client_claim_lines', []);
    await this.syncTable<any>('internal_manpower_client_links', 'internal_manpower_client_links', [], (item: any) => {
      // Recalculate weight as percentage if needed to avoid column overflow
      const allLinks = this.get<InternalManpowerClientLink>('internal_manpower_client_links', []);
      const linksForThisItem = allLinks.filter(l => l.internal_boq_item_id === item.internal_boq_item_id);

      let totalClientValue = 0;
      linksForThisItem.forEach(l => {
        const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === l.client_boq_item_id);
        if (clientItem) {
          totalClientValue += clientItem.value;
        }
      });

      const clientItem = this.get<ClientBOQItem>('client_boq', []).find(c => c.id === item.client_boq_item_id);
      let weight = 100.00;
      if (clientItem && totalClientValue > 0) {
        weight = (clientItem.value / totalClientValue) * 100;
      }

      // Clamp weight to ensure it never overflows NUMERIC(5, 2)
      if (weight > 999.99) weight = 999.99;
      if (weight < 0) weight = 0;

      return {
        id: item.id,
        internal_boq_item_id: item.internal_boq_item_id,
        client_boq_item_id: item.client_boq_item_id,
        allocation_weight: weight,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('tasks', 'tasks', [], (item: any) => {
      return {
        id: item.id,
        project_id: item.project_id,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        assigned_to: item.assigned_to,
        due_date: item.due_date,
        boq_item_id: item.boq_item_id || null,
        progress: item.progress,
        estimated_hours: item.estimated_hours || null,
        actual_hours: item.actual_hours || null,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });
    await this.syncTable<any>('users', 'users', [], (item: any) => {
      return {
        id: item.id,
        username: item.username,
        role: item.role,
        password_hash: item.password_hash,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('activity_logs', 'activity_logs', [], (item: any) => {
      return {
        id: item.id,
        change_summary: item.change_summary,
        user_details: item.user_details,
        timestamp: item.timestamp,
        environment: item.environment,
        before_screenshot: item.before_screenshot,
        after_screenshot: item.after_screenshot,
        fields_changed: item.fields_changed,
        reason_or_ticket: item.reason_or_ticket,
        rollback_instructions: item.rollback_instructions || null,
        verification_steps: item.verification_steps,
        created_at: item.created_at
      };
    });
    await this.syncTable<any>('task_messages', 'task_messages', [], (item: any) => {
      return {
        id: item.id,
        task_id: item.task_id,
        sender: item.sender,
        message: item.message,
        attachment_name: item.attachment_name || null,
        attachment_data: item.attachment_data || null,
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

      // Sync zoho settings
      try {
        const { data: dbZoho, error: zohoErr } = await supabase.from('zoho_integration_settings').select('*').eq('id', 'current_zoho_config').maybeSingle();
        if (!zohoErr && dbZoho) {
          const mappedSettings: ZohoSettings = {
            clientId: dbZoho.client_id,
            clientSecret: dbZoho.client_secret,
            organizationId: dbZoho.organization_id,
            region: dbZoho.region,
            accessToken: dbZoho.access_token,
            refreshToken: dbZoho.refresh_token,
            expiryTime: dbZoho.expiry_time ? Number(dbZoho.expiry_time) : null,
            materialAccountName: dbZoho.material_account_name,
            subcontractAccountName: dbZoho.subcontract_account_name
          };
          localStorage.setItem('pms_zoho_settings', JSON.stringify(mappedSettings));
        } else if (!zohoErr && !dbZoho) {
          const local = localStorage.getItem('pms_zoho_settings');
          if (local) {
            try {
              const parsed = JSON.parse(local) as ZohoSettings;
              await supabase.from('zoho_integration_settings').upsert({
                id: 'current_zoho_config',
                client_id: parsed.clientId,
                client_secret: parsed.clientSecret,
                organization_id: parsed.organizationId,
                region: parsed.region,
                access_token: parsed.accessToken,
                refresh_token: parsed.refreshToken,
                expiry_time: parsed.expiryTime,
                material_account_name: parsed.materialAccountName,
                subcontract_account_name: parsed.subcontractAccountName
              });
            } catch (e) {
              console.error('Failed to upload local zoho settings to Supabase:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to sync zoho settings from Supabase:', e);
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
    if (user && String(user.password_hash) === String(password)) return user;
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
      this.notify();
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
      this.notify();
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
      this.notify();

      // Update Supabase if client is available
      const client = supabase;
      if (client) {
        client.from('company_details').upsert({ id: 'current_config', ...details }).then(({ error }) => {
          if (error) console.error('Supabase saveCompanyDetails error:', error);
        });
      }
    }
  }

  getZohoSettings(): ZohoSettings {
    const defaultSettings: ZohoSettings = {
      clientId: '1000.0WS4HOIEVS9GVEBE0W1UP72946WQJF',
      clientSecret: '9fba1e918fe1b1798898ab715e6c3ca9f99b27022f',
      organizationId: '745487428',
      region: 'com',
      accessToken: null,
      refreshToken: null,
      expiryTime: null,
      materialAccountName: 'Purchase of Items for Projects',
      subcontractAccountName: 'Outsourced Works'
    };
    if (!this.isClient) return defaultSettings;
    const stored = localStorage.getItem('pms_zoho_settings');
    if (!stored) return defaultSettings;
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch {
      return defaultSettings;
    }
  }

  saveZohoSettings(settings: ZohoSettings): void {
    if (this.isClient) {
      localStorage.setItem('pms_zoho_settings', JSON.stringify(settings));
      this.notify();

      const client = supabase;
      if (client) {
        client.from('zoho_integration_settings').upsert({
          id: 'current_zoho_config',
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          organization_id: settings.organizationId,
          region: settings.region,
          access_token: settings.accessToken,
          refresh_token: settings.refreshToken,
          expiry_time: settings.expiryTime,
          material_account_name: settings.materialAccountName,
          subcontract_account_name: settings.subcontractAccountName
        }).then(({ error }) => {
          if (error) {
            console.error('Supabase saveZohoSettings error:', error.message, 'Code:', error.code, 'Details:', error.details, 'Hint:', error.hint);
          }
        });
      }
    }
  }

  // --- Activity Logs ---
  getActivityLogs(): ActivityLog[] {
    const seedLogs: ActivityLog[] = [
      {
        id: 'log-seed-1',
        change_summary: 'Restructured user access privileges to implement least-privilege access control on staging',
        user_details: { name: 'Jane Doe', userId: 'usr_982347', role: 'Database Administrator' },
        timestamp: '2026-07-03T11:15:47+04:00',
        environment: 'staging',
        before_screenshot: { filename: 'db_permissions_before.png', description: 'Staging dashboard showing full write permission toggle active for all users' },
        after_screenshot: { filename: 'db_permissions_after.png', description: 'Staging dashboard showing write permission toggle disabled and read-only badge applied' },
        fields_changed: [
          { field: 'role_permissions.level', oldValue: 'admin', newValue: 'read_only' },
          { field: 'role_permissions.updated_at', oldValue: '2026-06-01T00:00:00Z', newValue: '2026-07-03T07:15:47Z' }
        ],
        reason_or_ticket: '[INFRA-1042] Restrict public write permissions on staging environment database roles.',
        rollback_instructions: 'Run SQL migration rollback_permissions_v2.sql to revert database role permissions to their previous state.',
        verification_steps: 'Log in as a staging test user and verify that insert/update queries return 403 Forbidden status.',
        created_at: '2026-07-03T07:15:47Z'
      },
      {
        id: 'log-seed-2',
        change_summary: 'Restricted access to the Settings page and navigation tab to users with the admin role',
        user_details: { name: 'Jane Doe', userId: 'usr_982347', role: 'Principal Engineer' },
        timestamp: '2026-07-03T11:18:28+04:00',
        environment: 'staging',
        before_screenshot: { filename: 'settings_access_before.png', description: 'Non-admin navigation showing Settings link and granting access to /settings page' },
        after_screenshot: { filename: 'settings_access_after.png', description: 'Non-admin navigation with Settings link hidden, and access to /settings redirecting to unauthorized error page' },
        fields_changed: [
          { field: 'settings_route.allowed_roles', oldValue: "['admin', 'editor', 'viewer']", newValue: "['admin']" },
          { field: 'navigation_menu.settings_visible', oldValue: 'true (all roles)', newValue: 'false (non-admin roles)' }
        ],
        reason_or_ticket: '[SEC-409] Restrict settings panel access to admin users to prevent unauthorized configuration changes.',
        rollback_instructions: 'Revert the changes to the navigation component and routing middleware using git checkout HEAD~1 -- src/middleware.ts src/components/Navbar.tsx and redeploy.',
        verification_steps: '1. Log in as a user with viewer or editor role; verify that Settings is not visible in the navigation panel.\n2. Log in as admin and verify access.',
        created_at: '2026-07-03T07:18:28Z'
      }
    ];

    return this.get<ActivityLog>('activity_logs', seedLogs);
  }

  saveActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'> & { id?: string }): ActivityLog {
    const logs = this.getActivityLogs();
    const newLog: ActivityLog = {
      ...log,
      id: log.id || generateUUID(),
      created_at: new Date().toISOString()
    };
    const index = logs.findIndex(l => l.id === newLog.id);
    if (index >= 0) {
      logs[index] = newLog;
    } else {
      logs.unshift(newLog); // Put newest logs first
    }
    this.save('activity_logs', logs);

    // Sync to Supabase if config exists (optional database syncing)
    if (supabase) {
      supabase.from('activity_logs').upsert(newLog).then(({ error }) => {
        if (error) console.error('Supabase saveActivityLog error:', error);
      });
    }

    return newLog;
  }

  deleteActivityLog(id: string): void {
    const logs = this.getActivityLogs().filter(l => l.id !== id);
    this.save('activity_logs', logs);
    this.trackDeletion(id);

    if (supabase) {
      supabase.from('activity_logs').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase deleteActivityLog error:', error);
      });
    }
  }

  getCurrentUser(): User | null {
    if (!this.isClient) return null;
    const stored = sessionStorage.getItem('pms_current_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }

  logUserAction(
    summary: string,
    fieldsChanged: ActivityLogFieldChanged[] = [],
    reason: string = 'User Action'
  ): void {
    const user = this.getCurrentUser();
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    const offset = - (new Date()).getTimezoneOffset();
    const diff = offset >= 0 ? '+' : '-';
    const pad = (num: number) => (num < 10 ? '0' : '') + num;
    const timezone = diff + pad(Math.floor(Math.abs(offset) / 60)) + ':' + pad(Math.abs(offset) % 60);
    const timestamp = localISOTime + timezone;

    this.saveActivityLog({
      change_summary: summary,
      user_details: {
        name: user?.username || 'System',
        userId: user?.id || 'system',
        role: user?.role || 'System'
      },
      timestamp,
      environment: 'dev',
      before_screenshot: { filename: 'N/A', description: 'Not applicable' },
      after_screenshot: { filename: 'N/A', description: 'Not applicable' },
      fields_changed: fieldsChanged,
      reason_or_ticket: reason,
      rollback_instructions: 'N/A',
      verification_steps: 'Check the corresponding module dashboard to verify the change.'
    });
  }
}

export const db = new DatabaseManager();
export default db;
