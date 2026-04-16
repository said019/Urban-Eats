import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { buildApplePassBuffer, getAuthToken } from '@/lib/apple-wallet';

export const dynamic = 'force-dynamic';

// GET /api/wallet/v1/passes/:passTypeId/:serialNumber
// Apple Wallet pide el .pkpass actualizado después de recibir push.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ passTypeId: string; serialNumber: string }> }
) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^ApplePass\s+/, '');
  if (token !== getAuthToken()) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { serialNumber } = await params;

    const { rows } = await pool.query(
      'SELECT id, name, stamps FROM clients WHERE id::text = $1',
      [serialNumber]
    );
    if (rows.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const client = rows[0];
    const buffer = await buildApplePassBuffer(client.id, client.name, client.stamps);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': new Date().toUTCString(),
      },
    });
  } catch (err: any) {
    console.error('[Wallet] Get latest pass error:', err);
    return new NextResponse('Server Error', { status: 500 });
  }
}
