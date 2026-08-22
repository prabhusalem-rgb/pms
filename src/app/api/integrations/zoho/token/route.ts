import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, clientId, clientSecret, region, redirectUri } = await request.json();

    if (!code || !clientId || !clientSecret || !region || !redirectUri) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tokenUrl = `https://accounts.zoho.${region}/oauth/v2/token`;
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json({ error: data.error || 'Failed to exchange token' }, { status: response.status });
    }

    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in, // in seconds
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
