import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const CLASS_SUFFIX = 'urban_eats_loyalty_v1';

function loadPrivateKey(): string {
  if (process.env.GOOGLE_SA_PRIVATE_KEY) {
    return process.env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }
  try {
    const assetsDir = path.join(process.cwd(), 'wallet-assets', 'apple.pass');
    return fs.readFileSync(path.join(assetsDir, 'google_private.pem'), 'utf8');
  } catch {
    return '';
  }
}

async function getAccessToken(serviceEmail: string, privateKey: string): Promise<string> {
  const algorithm = privateKey.includes('BEGIN EC') ? 'ES256' : 'RS256';
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: serviceEmail,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm }
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth2 falló: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function ensureLoyaltyClass(accessToken: string, classId: string, origin: string) {
  // Check if exists
  const getRes = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(classId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (getRes.ok) return;
  if (getRes.status !== 404) {
    const err = await getRes.text();
    throw new Error(`Error consultando clase: ${err}`);
  }

  // Create it
  const classBody = {
    id: classId,
    issuerName: 'Urban Eats',
    programName: 'Urban Eats Rewards',
    programLogo: {
      sourceUri: { uri: `${origin}/logo.jpeg` },
      contentDescription: {
        defaultValue: { language: 'es-MX', value: 'Urban Eats' },
      },
    },
    hexBackgroundColor: '#1a0f05',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
    rewardsTier: 'Gold',
    rewardsTierLabel: 'Miembro',
  };

  const createRes = await fetch(`${WALLET_API}/loyaltyClass`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(classBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Error creando clase Google Wallet: ${err}`);
  }
}

function buildSaveUrl(
  serviceEmail: string,
  privateKey: string,
  classId: string,
  objectId: string,
  clientId: string,
  clientName: string,
  stamps: number,
  origin: string
): string {
  const algorithm = privateKey.includes('BEGIN EC') ? 'ES256' : 'RS256';
  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, 10));

  const loyaltyObject = {
    id: objectId,
    classId,
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
      alternateText: clientName,
    },
    textModulesData: [
      {
        id: 'reward',
        header: 'PRÓXIMO PREMIO',
        body:
          safeStamps >= 10
            ? '¡PERRO GRATIS!'
            : safeStamps >= 5
            ? '¡25% OFF disponible!'
            : `Faltan ${5 - safeStamps} sellos para 25% OFF`,
      },
    ],
  };

  const claims = {
    iss: serviceEmail,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    payload: {
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

    const ISSUER_ID = process.env.GOOGLE_ISSUER_ID || '';
    const SERVICE_EMAIL =
      process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const privateKey = loadPrivateKey();

    if (!ISSUER_ID || !SERVICE_EMAIL || !privateKey) {
      return NextResponse.json(
        {
          error:
            'Google Wallet no está configurado (falta GOOGLE_ISSUER_ID, GOOGLE_SA_EMAIL o GOOGLE_SA_PRIVATE_KEY)',
        },
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
