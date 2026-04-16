import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const next = `/admin/clients/${encodeURIComponent(clientId)}`;
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', next);

  return NextResponse.redirect(loginUrl, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
