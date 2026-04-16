import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthToken } from '@/lib/apple-wallet';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^ApplePass\s+/, '');
  return token === getAuthToken();
}

// POST /api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string; serialNumber: string }> }
) {
  if (!checkAuth(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { deviceId, passTypeId, serialNumber } = await params;
    const { pushToken } = await request.json();

    if (!pushToken) {
      return new NextResponse('Missing pushToken', { status: 400 });
    }

    // Verificar que el serial corresponda a un cliente existente
    const client = await pool.query('SELECT id FROM clients WHERE id::text = $1', [serialNumber]);
    if (client.rows.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const existing = await pool.query(
      'SELECT id FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2 AND loyalty_card_id = $3',
      [deviceId, passTypeId, serialNumber]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE apple_wallet_devices SET push_token = $1, updated_at = now() WHERE id = $2',
        [pushToken, existing.rows[0].id]
      );
      return new NextResponse(null, { status: 200 });
    }

    await pool.query(
      `INSERT INTO apple_wallet_devices (device_id, push_token, pass_type_id, loyalty_card_id)
       VALUES ($1, $2, $3, $4)`,
      [deviceId, pushToken, passTypeId, serialNumber]
    );

    return new NextResponse(null, { status: 201 });
  } catch (err: any) {
    console.error('[Wallet] Register device error:', err);
    return new NextResponse('Server Error', { status: 500 });
  }
}

// DELETE /api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string; serialNumber: string }> }
) {
  if (!checkAuth(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { deviceId, passTypeId, serialNumber } = await params;
    await pool.query(
      'DELETE FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2 AND loyalty_card_id = $3',
      [deviceId, passTypeId, serialNumber]
    );
    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error('[Wallet] Unregister device error:', err);
    return new NextResponse('Server Error', { status: 500 });
  }
}
