import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

function buildGoogleWalletUrl(clientId: string, clientName: string, stamps: number): string {
  const ISSUER_ID = process.env.GOOGLE_ISSUER_ID || '';
  const SERVICE_EMAIL = process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  if (!ISSUER_ID || !SERVICE_EMAIL) {
    throw new Error('Google Wallet no está configurado (Faltan GOOGLE_ISSUER_ID o GOOGLE_SA_EMAIL)');
  }

  const assetsDir = path.join(process.cwd(), 'wallet-assets', 'apple.pass');
  let privateKey = '';

  if (process.env.GOOGLE_SA_PRIVATE_KEY) {
    privateKey = process.env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  } else if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    privateKey = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  } else {
    try {
      privateKey = fs.readFileSync(path.join(assetsDir, 'google_private.pem'), 'utf8');
    } catch {}
  }

  if (!privateKey) {
    throw new Error('No se encontró la clave privada de Google Wallet');
  }

  const algorithm = privateKey.includes('BEGIN EC') ? 'ES256' : 'RS256';

  const CLASS_SUFFIX = 'urban_eats_loyalty';
  const CLASS_ID = `${ISSUER_ID}.${CLASS_SUFFIX}`;
  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, 10));
  const objectId = `${ISSUER_ID}.${clientId.replace(/-/g, '_')}`;
  const origin = process.env.SERVER_URL || 'https://urban-eats-production.up.railway.app';

  const loyaltyObject = {
    id: objectId,
    classId: CLASS_ID,
    state: 'ACTIVE',
    accountId: clientId,
    accountName: clientName,
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: safeStamps },
    },
    barcode: {
      type: 'QR_CODE',
      value: clientId,
      alternateText: clientId,
    },
    textModulesData: [
      {
        header: 'PRÓXIMO PREMIO',
        body:
          safeStamps >= 10
            ? '¡PERRO GRATIS!'
            : safeStamps >= 5
            ? '¡25% OFF disponible!'
            : `Faltan ${5 - safeStamps} sellos para 25% OFF`,
      },
    ],
    infoModuleData: {
      labelValueRows: [
        {
          columns: [
            { label: 'Miembro', value: clientName },
            { label: 'Sellos', value: `${safeStamps} / 10` },
          ],
        },
      ],
    },
  };

  const loyaltyClass = {
    id: CLASS_ID,
    issuerName: 'Urban Eats',
    programName: 'Urban Eats Rewards',
    programLogo: {
      sourceUri: { uri: `${origin}/logo.jpeg` },
      contentDescription: {
        defaultValue: { language: 'es', value: 'Urban Eats Logo' },
      },
    },
    hexBackgroundColor: '#0f1115',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
  };

  const claims = {
    iss: SERVICE_EMAIL,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  const token = jwt.sign(claims, privateKey, { algorithm });
  return `https://pay.google.com/gp/v/save/${token}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { rows } = await pool.query(
      'SELECT id, name, stamps FROM clients WHERE id::text = $1',
      [clientId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const client = rows[0];
    const saveUrl = buildGoogleWalletUrl(client.id, client.name, client.stamps);
    return NextResponse.json({ saveUrl });
  } catch (err: any) {
    console.error('[Google Wallet] Error:', err);
    if (err.message?.includes('no está configurado') || err.message?.includes('clave privada')) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: 'Error generando el pase de Google Wallet' },
      { status: 500 }
    );
  }
}
