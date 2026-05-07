import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { buildWalletQrValue } from './wallet-qr';

export const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
export const CLASS_SUFFIX = 'bunsik_ramen_loyalty_v1';
export const MAX_STAMPS = 6;

export function loadPrivateKey(): string {
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

export async function getAccessToken(serviceEmail: string, privateKey: string): Promise<string> {
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
  if (!res.ok) throw new Error(`OAuth2 falló: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function ensureLoyaltyClass(accessToken: string, classId: string, origin: string) {
  const getRes = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(classId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (getRes.ok) return;
  if (getRes.status !== 404) {
    throw new Error(`Error consultando clase: ${await getRes.text()}`);
  }

  const classBody = {
    id: classId,
    issuerName: 'Bunsik Ramen',
    programName: 'Bunsik Rewards',
    programLogo: {
      sourceUri: { uri: `${origin}/logo.jpeg` },
      contentDescription: {
        defaultValue: { language: 'es-MX', value: 'Bunsik Ramen' },
      },
    },
    hexBackgroundColor: '#831843',          // pink-900
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
    rewardsTier: 'Bunsik Member',
    rewardsTierLabel: 'Miembro',
    accountIdLabel: 'ID Miembro',
    accountNameLabel: 'Cliente',
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
    throw new Error(`Error creando clase: ${await createRes.text()}`);
  }
}

function buildObjectBody(
  classId: string,
  objectId: string,
  clientId: string,
  clientName: string,
  stamps: number,
  origin?: string
) {
  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, MAX_STAMPS));
  const qrValue = buildWalletQrValue(clientId, origin);
  const remaining = Math.max(0, MAX_STAMPS - safeStamps);
  const rewardBody = safeStamps >= MAX_STAMPS
    ? '¡Tu próximo ramen va por la casa! Muestra esta tarjeta en caja.'
    : remaining === 1
    ? '¡Solo te falta 1 ramen para ganar uno gratis! 🍜'
    : `Te faltan ${remaining} ramens para tu próximo gratis.`;

  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountId: clientId,
    accountName: clientName,
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: safeStamps },
    },
    secondaryLoyaltyPoints: {
      label: 'Meta',
      balance: { int: MAX_STAMPS },
    },
    barcode: {
      type: 'QR_CODE',
      value: qrValue,
      alternateText: 'Escanear para sello',
    },
    heroImage: {
      sourceUri: { uri: `${origin || ''}/api/loyalty/assets/strip@2x.png` },
      contentDescription: {
        defaultValue: { language: 'es-MX', value: 'Tarjeta Bunsik Ramen' },
      },
    },
    textModulesData: [
      {
        id: 'reward',
        header: 'PRÓXIMO PREMIO',
        body: rewardBody,
      },
      {
        id: 'how',
        header: 'CÓMO FUNCIONA',
        body: `Compra ${MAX_STAMPS} ramens y el siguiente va gratis 🍜. Cada ramen suma 1 sello automáticamente al pagar.`,
      },
      {
        id: 'social',
        header: 'SÍGUENOS',
        body: 'Instagram @doriperros_ · WhatsApp en chat.whatsapp.com/G8BmDSK06lL16s1zzx7b93',
      },
    ],
    linksModuleData: {
      uris: [
        {
          uri: 'https://www.instagram.com/doriperros_',
          description: 'Instagram',
          id: 'ig',
        },
        {
          uri: 'https://chat.whatsapp.com/G8BmDSK06lL16s1zzx7b93',
          description: 'Grupo WhatsApp',
          id: 'wa',
        },
      ],
    },
  };
}

export async function upsertLoyaltyObject(
  accessToken: string,
  classId: string,
  objectId: string,
  clientId: string,
  clientName: string,
  stamps: number,
  origin?: string
) {
  const body = buildObjectBody(classId, objectId, clientId, clientName, stamps, origin);

  // Try PATCH first (if exists)
  const patchRes = await fetch(`${WALLET_API}/loyaltyObject/${encodeURIComponent(objectId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (patchRes.ok) return { action: 'updated' };
  if (patchRes.status !== 404) {
    throw new Error(`PATCH object falló: ${await patchRes.text()}`);
  }

  // Not found → POST to create
  const postRes = await fetch(`${WALLET_API}/loyaltyObject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!postRes.ok) throw new Error(`POST object falló: ${await postRes.text()}`);
  return { action: 'created' };
}

export function buildSaveUrl(
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
  const loyaltyObject = buildObjectBody(classId, objectId, clientId, clientName, stamps, origin);

  const claims = {
    iss: serviceEmail,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    payload: { loyaltyObjects: [loyaltyObject] },
  };

  const token = jwt.sign(claims, privateKey, { algorithm });
  return `https://pay.google.com/gp/v/save/${token}`;
}

export async function updateGoogleWalletStamps(clientId: string, clientName: string, stamps: number): Promise<void> {
  const ISSUER_ID = process.env.GOOGLE_ISSUER_ID || '';
  const SERVICE_EMAIL =
    process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = loadPrivateKey();

  if (!ISSUER_ID || !SERVICE_EMAIL || !privateKey) {
    console.warn('[Google Wallet] No configurado, saltando update');
    return;
  }

  const origin = process.env.SERVER_URL || 'https://urban-eats-production.up.railway.app';
  const classId = `${ISSUER_ID}.${CLASS_SUFFIX}`;
  const objectId = `${ISSUER_ID}.${clientId.replace(/-/g, '_')}`;

  try {
    const accessToken = await getAccessToken(SERVICE_EMAIL, privateKey);
    await ensureLoyaltyClass(accessToken, classId, origin);
    await upsertLoyaltyObject(accessToken, classId, objectId, clientId, clientName, stamps, origin);
  } catch (err: any) {
    console.error('[Google Wallet] Error actualizando:', err.message);
  }
}
