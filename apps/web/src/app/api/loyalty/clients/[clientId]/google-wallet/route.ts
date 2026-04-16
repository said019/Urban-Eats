import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  CLASS_SUFFIX,
  ensureLoyaltyClass,
  getAccessToken,
  loadPrivateKey,
  upsertLoyaltyObject,
  buildSaveUrl,
} from '@/lib/google-wallet';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const ISSUER_ID = process.env.GOOGLE_ISSUER_ID || '';
    const SERVICE_EMAIL =
      process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const privateKey = loadPrivateKey();

    if (!ISSUER_ID || !SERVICE_EMAIL || !privateKey) {
      return NextResponse.json(
        { error: 'Google Wallet no está configurado (falta GOOGLE_ISSUER_ID, GOOGLE_SA_EMAIL o GOOGLE_SA_PRIVATE_KEY)' },
        { status: 503 }
      );
    }

    const { rows } = await pool.query(
      'SELECT id, name, stamps FROM clients WHERE id::text = $1',
      [clientId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const client = rows[0];
    const origin = process.env.SERVER_URL || 'https://urban-eats-production.up.railway.app';
    const classId = `${ISSUER_ID}.${CLASS_SUFFIX}`;
    const objectId = `${ISSUER_ID}.${client.id.replace(/-/g, '_')}`;

    const accessToken = await getAccessToken(SERVICE_EMAIL, privateKey);
    await ensureLoyaltyClass(accessToken, classId, origin);
    await upsertLoyaltyObject(accessToken, classId, objectId, client.id, client.name, client.stamps, origin);

    const saveUrl = buildSaveUrl(
      SERVICE_EMAIL,
      privateKey,
      classId,
      objectId,
      client.id,
      client.name,
      client.stamps,
      origin
    );

    return NextResponse.json({ saveUrl });
  } catch (err: any) {
    console.error('[Google Wallet] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Error generando el pase de Google Wallet' },
      { status: 500 }
    );
  }
}
