import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    let { settings, type, payload, entityId } = await request.json();

    if (!type || !payload) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Try to fetch latest Zoho integration settings from Supabase database to ensure we're using the most current tokens
    let dbSettings: any = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('zoho_integration_settings')
        .select('*')
        .eq('id', 'current_zoho_config')
        .maybeSingle();
      if (!error && data) {
        dbSettings = {
          clientId: data.client_id,
          clientSecret: data.client_secret,
          organizationId: data.organization_id,
          region: data.region,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiryTime: data.expiry_time ? Number(data.expiry_time) : null,
          materialAccountName: data.material_account_name,
          subcontractAccountName: data.subcontract_account_name
        };
      }
    }

    // Use DB settings if available, otherwise fall back to settings passed in request
    const activeSettings = dbSettings || settings;

    if (!activeSettings || !activeSettings.clientId) {
      return NextResponse.json({ error: 'Missing required settings' }, { status: 400 });
    }

    let accessToken = activeSettings.accessToken;
    let expiryTime = activeSettings.expiryTime;
    let tokenRefreshed = false;

    const region = activeSettings.region || 'com';

    // Check if token needs to be refreshed (expires in less than 2 minutes)
    const isExpired = !expiryTime || (Date.now() + 120000 >= expiryTime);
    if (isExpired && activeSettings.refreshToken) {
      const tokenUrl = `https://accounts.zoho.${region}/oauth/v2/token`;
      const refreshParams = new URLSearchParams({
        refresh_token: activeSettings.refreshToken,
        client_id: activeSettings.clientId,
        client_secret: activeSettings.clientSecret,
        grant_type: 'refresh_token',
      });

      const refreshResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: refreshParams.toString(),
      });

      const refreshData = await refreshResponse.json();
      if (refreshResponse.ok && refreshData.access_token) {
        accessToken = refreshData.access_token;
        expiryTime = Date.now() + (refreshData.expires_in * 1000);
        tokenRefreshed = true;

        // Save refreshed tokens directly to Supabase to keep all instances authorized
        if (supabase) {
          await supabase.from('zoho_integration_settings').update({
            access_token: accessToken,
            expiry_time: expiryTime
          }).eq('id', 'current_zoho_config');
        }
      } else {
        return NextResponse.json({
          error: refreshData.error || 'Failed to refresh access token'
        }, { status: 401 });
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated with Zoho Books' }, { status: 401 });
    }

    // Determine Zoho API URL and Method
    let url = `https://www.zohoapis.${region}/books/v3`;
    let method = 'POST';

    if (type === 'accounts_list') {
      url += `/chartofaccounts`;
      method = 'GET';
    } else if (type === 'supplier_search') {
      url += `/contacts`;
      method = 'GET';
    } else if (type === 'supplier_get') {
      if (!entityId) {
        return NextResponse.json({ error: 'Missing Supplier ID' }, { status: 400 });
      }
      url += `/contacts/${entityId}`;
      method = 'GET';
    } else if (type === 'supplier') {
      url += entityId ? `/contacts/${entityId}` : '/contacts';
      method = entityId ? 'PUT' : 'POST';
    } else if (type === 'item') {
      url += entityId ? `/items/${entityId}` : '/items';
      method = entityId ? 'PUT' : 'POST';
    } else if (type === 'po') {
      url += entityId ? `/purchaseorders/${entityId}` : '/purchaseorders';
      method = entityId ? 'PUT' : 'POST';
    } else if (type === 'po_void') {
      if (!entityId) {
        return NextResponse.json({ error: 'Missing Purchase Order ID for void action' }, { status: 400 });
      }
      url += `/purchaseorders/${entityId}/status/cancelled`;
      method = 'POST';
    } else if (type === 'project') {
      url += entityId ? `/projects/${entityId}` : '/projects';
      method = entityId ? 'PUT' : 'POST';
    } else if (type === 'project_list') {
      url += `/projects`;
      method = 'GET';
    } else {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    url += `?organization_id=${activeSettings.organizationId}`;
    if (type === 'supplier_search' && payload.contact_name) {
      url += `&contact_name=${encodeURIComponent(payload.contact_name)}`;
    }

    const headers = {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET') {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return NextResponse.json({ error: `Invalid response from Zoho: ${responseText}` }, { status: 502 });
    }

    if (!response.ok || responseData.code !== 0) {
      return NextResponse.json({
        error: responseData.message || `Zoho API Error (${responseData.code})`
      }, { status: response.status === 200 ? 400 : response.status });
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      tokenRefreshed,
      accessToken: tokenRefreshed ? accessToken : null,
      expiryTime: tokenRefreshed ? expiryTime : null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
