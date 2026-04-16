import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_PUBLIC_ORIGIN = 'https://urban-eats-production.up.railway.app';

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || 'urban-eats-production.up.railway.app';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const proto = forwardedProto || (host.includes('localhost') ? 'http' : 'https');

  if (host.includes('localhost') && process.env.NODE_ENV === 'production') {
    return (process.env.SERVER_URL || process.env.FRONTEND_URL || DEFAULT_PUBLIC_ORIGIN).replace(/\/+$/, '');
  }

  return `${proto}://${host}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const next = `/admin/clients/${encodeURIComponent(clientId)}`;
  const loginUrl = new URL('/admin/login', publicOrigin(request));
  loginUrl.searchParams.set('next', next);

  return NextResponse.redirect(loginUrl, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
