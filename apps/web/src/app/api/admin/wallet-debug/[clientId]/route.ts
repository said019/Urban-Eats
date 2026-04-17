import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

function auth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  try {
    jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// GET /api/admin/wallet-debug/:clientId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { clientId } = await params;

  const devices = await pool.query(
    `SELECT id, device_id, LEFT(push_token, 12) || '…' AS push_preview, pass_type_id, created_at, updated_at
     FROM apple_wallet_devices WHERE loyalty_card_id::text = $1 ORDER BY updated_at DESC`,
    [clientId]
  );

  const updates = await pool.query(
    `SELECT stamps_new, updated_at FROM apple_wallet_updates
     WHERE loyalty_card_id::text = $1 ORDER BY updated_at DESC LIMIT 10`,
    [clientId]
  );

  const envCheck = {
    APPLE_TEAM_ID: !!process.env.APPLE_TEAM_ID,
    APPLE_PASS_TYPE_ID: !!process.env.APPLE_PASS_TYPE_ID,
    APPLE_KEY_ID: !!process.env.APPLE_KEY_ID,
    APPLE_APNS_KEY_BASE64: !!process.env.APPLE_APNS_KEY_BASE64,
    APPLE_AUTH_TOKEN: !!process.env.APPLE_AUTH_TOKEN,
    APPLE_SIGNER_CERT_BASE64: !!process.env.APPLE_SIGNER_CERT_BASE64,
    APPLE_SIGNER_KEY_BASE64: !!process.env.APPLE_SIGNER_KEY_BASE64,
    APPLE_WWDR_CERT_BASE64: !!process.env.APPLE_WWDR_CERT_BASE64,
    GOOGLE_ISSUER_ID: !!process.env.GOOGLE_ISSUER_ID,
    GOOGLE_SA_EMAIL: !!(process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    GOOGLE_SA_PRIVATE_KEY: !!(process.env.GOOGLE_SA_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64),
    SERVER_URL: process.env.SERVER_URL || '(not set, using default)',
  };

  return NextResponse.json({
    clientId,
    registeredDevices: devices.rows,
    deviceCount: devices.rows.length,
    recentUpdates: updates.rows,
    env: envCheck,
    message:
      devices.rows.length === 0
        ? 'Este cliente no tiene dispositivos Apple registrados. El pase actual NO tiene webServiceURL. El cliente debe ELIMINAR el pase de su Wallet y DESCARGARLO DE NUEVO para registrarse.'
        : `${devices.rows.length} dispositivo(s) registrado(s). Al dar sello se envía push.`,
  });
}
