import { db, Supplier, BOQItem, PurchaseOrder } from './db';

class ZohoBooksClient {
  private async callProxy(type: 'accounts_list' | 'supplier_search' | 'supplier' | 'supplier_get' | 'item' | 'po' | 'po_void' | 'project' | 'project_list', payload: any, entityId?: string | null): Promise<any> {
    const settings = db.getZohoSettings();
    if (!settings.refreshToken) {
      throw new Error('Zoho Books is not connected. Please authorize it in Settings.');
    }

    const response = await fetch('/api/integrations/zoho/sync-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        settings,
        type,
        payload,
        entityId
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || `Failed to sync ${type}`);
    }

    // Update settings if tokens were refreshed by the proxy
    if (data.tokenRefreshed && data.accessToken && data.expiryTime) {
      db.saveZohoSettings({
        ...settings,
        accessToken: data.accessToken,
        expiryTime: data.expiryTime
      });
    }

    return data.data;
  }

  private async getAccountIdByName(accountName: string): Promise<string> {
    const res = await this.callProxy('accounts_list', {});
    const account = res.chartofaccounts?.find(
      (acc: any) => acc.account_name.toLowerCase() === accountName.toLowerCase()
    );

    if (!account) {
      throw new Error(`Account "${accountName}" not found in Zoho Books. Please create it or configure a different account name in Settings.`);
    }

    return account.account_id;
  }

  async syncSupplier(supplierId: string): Promise<string> {
    const suppliers = db.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const payload = {
      contact_name: supplier.name,
      company_name: supplier.name,
      contact_type: 'vendor',
      tax_reg_no: supplier.vat_number || '',
      contact_persons: [
        {
          first_name: supplier.contact_person || supplier.name,
          email: supplier.email || '',
          phone: supplier.phone || ''
        }
      ]
    };

    let zohoContactId = supplier.zoho_contact_id;

    if (zohoContactId) {
      // Update existing Zoho contact
      await this.callProxy('supplier', payload, zohoContactId);
    } else {
      // Search to prevent duplicate contact name errors
      const searchRes = await this.callProxy('supplier_search', { contact_name: supplier.name });
      const existingContact = searchRes.contacts?.find(
        (c: any) => c.contact_name.toLowerCase() === supplier.name.toLowerCase() && c.contact_type === 'vendor'
      );

      if (existingContact) {
        zohoContactId = existingContact.contact_id;
      } else {
        // Create new contact
        const res = await this.callProxy('supplier', payload);
        zohoContactId = res.contact.contact_id;
      }

      // Save mapped ID locally
      db.saveSupplier({
        ...supplier,
        zoho_contact_id: zohoContactId
      }, true);
    }

    if (!zohoContactId) {
      throw new Error('Failed to resolve Zoho Contact ID');
    }

    return zohoContactId;
  }

  async refreshSupplierDetails(supplierId: string): Promise<void> {
    const suppliers = db.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const zohoContactId = supplier.zoho_contact_id;
    if (!zohoContactId) {
      throw new Error('Supplier is not linked/synced to Zoho Books');
    }

    const res = await this.callProxy('supplier_get', {}, zohoContactId);
    if (!res || !res.contact) {
      throw new Error('No contact details returned from Zoho Books');
    }

    const contact = res.contact;
    const contactPerson = contact.contact_persons?.[0];

    // Build formatted address
    const addr = contact.billing_address;
    const addressParts = [];
    if (addr) {
      if (addr.address) addressParts.push(addr.address);
      if (addr.city) addressParts.push(addr.city);
      if (addr.state) addressParts.push(addr.state);
      if (addr.country) addressParts.push(addr.country);
    }
    const formattedAddress = addressParts.join(', ') || supplier.address || '';

    // Update local database
    db.saveSupplier({
      ...supplier,
      name: contact.company_name || contact.contact_name || supplier.name,
      vat_number: contact.tax_reg_no || supplier.vat_number || '',
      contact_person: contactPerson ? `${contactPerson.first_name} ${contactPerson.last_name || ''}`.trim() : supplier.contact_person,
      email: contactPerson?.email || supplier.email || '',
      phone: contactPerson?.phone || supplier.phone || '',
      address: formattedAddress
    }, true);
  }

  async syncBOQItem(boqItemId: string): Promise<string> {
    const boqItems = db.getBOQItems();
    const item = boqItems.find(i => i.id === boqItemId);
    if (!item) throw new Error('BOQ item not found');

    const payload = {
      name: `${item.item_code} - ${item.description.substring(0, 80)}`,
      rate: item.unit_rate,
      purchase_rate: item.unit_rate,
      description: item.description,
      item_type: 'sales_and_purchases'
    };

    const res = await this.callProxy('item', payload, item.zoho_item_id);
    const zohoItemId = res.item.item_id;

    db.saveBOQItem({
      ...item,
      zoho_item_id: zohoItemId
    });

    return zohoItemId;
  }

  async syncProject(projectId: string): Promise<string> {
    const projects = db.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    if (project.zoho_project_id) {
      return project.zoho_project_id;
    }

    // 1. Search for existing project by name
    let zohoProjectId = '';
    try {
      const listRes = await this.callProxy('project_list', {});
      const existingProject = listRes.projects?.find(
        (p: any) => p.project_name.toLowerCase() === project.name.toLowerCase()
      );
      if (existingProject) {
        zohoProjectId = existingProject.project_id;
      }
    } catch (e) {
      console.warn('Failed to list projects from Zoho:', e);
    }

    if (!zohoProjectId) {
      // 2. We need a customer contact in Zoho
      const clientName = project.client || 'General Client';
      let customerId = '';

      // Search for client in Zoho contacts
      try {
        const searchRes = await this.callProxy('supplier_search', { contact_name: clientName });
        const existingContact = searchRes.contacts?.find(
          (c: any) => c.contact_name.toLowerCase() === clientName.toLowerCase()
        );
        if (existingContact) {
          customerId = existingContact.contact_id;
        }
      } catch (e) {
        console.warn('Failed to search contact in Zoho:', e);
      }

      if (!customerId) {
        // Create customer contact
        const contactPayload = {
          contact_name: clientName,
          company_name: clientName,
          contact_type: 'customer'
        };
        const contactRes = await this.callProxy('supplier', contactPayload);
        customerId = contactRes.contact.contact_id;
      }

      // 3. Create project in Zoho Books
      const projectPayload = {
        project_name: project.name,
        customer_id: customerId,
        billing_type: 'based_on_staff_hours',
        description: `Project setup for ${project.name} located at ${project.site_location || 'N/A'}`
      };

      const projectRes = await this.callProxy('project', projectPayload);
      zohoProjectId = projectRes.project.project_id;
    }

    // Save project with zoho_project_id locally and in DB
    db.saveProject({
      ...project,
      zoho_project_id: zohoProjectId
    });

    return zohoProjectId;
  }

  async syncPurchaseOrder(poId: string): Promise<string> {
    const pos = db.getPOs();
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.supplier_id) {
      throw new Error('Cannot sync Purchase Order to Zoho without a supplier selected.');
    }

    const suppliers = db.getSuppliers();
    const supplier = suppliers.find(s => s.id === po.supplier_id);
    if (!supplier) throw new Error('Supplier not found in local database');

    let zohoContactId = supplier.zoho_contact_id;
    if (!zohoContactId) {
      zohoContactId = await this.syncSupplier(supplier.id);
    }

    let zohoProjectId = '';
    if (po.project_id) {
      try {
        zohoProjectId = await this.syncProject(po.project_id);
      } catch (err) {
        console.error('Failed to sync project to Zoho:', err);
      }
    }

    const poLines = db.getPOLines(po.id);
    const settings = db.getZohoSettings();
    const materialAccount = settings.materialAccountName || 'Purchase of Items for Projects';
    const subcontractAccount = settings.subcontractAccountName || 'Outsourced Works';
    const accountName = po.type === 'subcontract' ? subcontractAccount : materialAccount;

    const accountId = await this.getAccountIdByName(accountName);

    const syncedLineItems = [];
    let order = 1;
    for (const line of poLines) {
      const fullDesc = line.supplier_description || line.description || '';
      syncedLineItems.push({
        name: fullDesc.substring(0, 100) || 'Item Description',
        description: fullDesc,
        rate: line.unit_rate,
        quantity: line.qty,
        tax_percentage: line.vat_rate,
        account_id: accountId,
        line_item_category: 'line_item',
        item_order: order++
      });
    }

    const payload: any = {
      vendor_id: zohoContactId,
      date: new Date(po.created_at).toISOString().split('T')[0],
      line_items: syncedLineItems,
      notes: po.description || '',
      terms: po.terms_and_conditions || ''
    };

    if (zohoProjectId) {
      payload.project_id = zohoProjectId;
    }

    // If it's an update, we must keep the existing PO number
    if (po.zoho_po_id) {
      payload.purchaseorder_number = po.po_number;
    }

    try {
      const res = await this.callProxy('po', payload, po.zoho_po_id);
      const zohoPOId = res.purchaseorder.purchaseorder_id;
      const zohoPONumber = res.purchaseorder.purchaseorder_number;

      db.savePO({
        ...po,
        po_number: zohoPONumber, // Overwrite with Zoho's auto-generated PO number
        zoho_po_id: zohoPOId
      }, poLines, true);

      return zohoPOId;
    } catch (err: any) {
      const errMsg = err.message ? err.message.toLowerCase() : '';
      if (errMsg.includes('does not exist') || errMsg.includes('not_found') || errMsg.includes('not found')) {
        // The PO might have been deleted in Zoho. Clear the Zoho PO ID locally and retry creation
        const updatedPO = {
          ...po,
          zoho_po_id: null
        };
        db.savePO(updatedPO, poLines, true);

        const newPayload = { ...payload };
        delete newPayload.purchaseorder_number;

        const res = await this.callProxy('po', newPayload, null);
        const zohoPOId = res.purchaseorder.purchaseorder_id;
        const zohoPONumber = res.purchaseorder.purchaseorder_number;

        db.savePO({
          ...updatedPO,
          po_number: zohoPONumber,
          zoho_po_id: zohoPOId
        }, poLines, true);

        return zohoPOId;
      }

      if (errMsg.includes('vendor') || errMsg.includes('contact')) {
        // Vendor might have been deleted or modified in Zoho Books. Clear the ID and re-sync
        db.saveSupplier({
          ...supplier,
          zoho_contact_id: null
        }, true);
        const newZohoContactId = await this.syncSupplier(supplier.id);
        payload.vendor_id = newZohoContactId;

        // Retry
        const res = await this.callProxy('po', payload, po.zoho_po_id);
        const zohoPOId = res.purchaseorder.purchaseorder_id;
        const zohoPONumber = res.purchaseorder.purchaseorder_number;

        db.savePO({
          ...po,
          po_number: zohoPONumber,
          zoho_po_id: zohoPOId
        }, poLines, true);

        return zohoPOId;
      }
      throw err;
    }
  }

  async voidPurchaseOrder(zohoPoId: string): Promise<void> {
    await this.callProxy('po_void', {}, zohoPoId);
  }
}

export const zohoClient = new ZohoBooksClient();
