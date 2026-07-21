import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?zoho_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?zoho_error=no_code_provided`);
  }

  // Redirect to the settings page with the code parameter
  return NextResponse.redirect(`${baseUrl}/settings?zoho_code=${encodeURIComponent(code)}`);
}
