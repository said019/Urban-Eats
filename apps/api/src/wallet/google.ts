import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const ISSUER_ID = process.env.GOOGLE_ISSUER_ID || '';
const CLASS_SUFFIX = 'urban_eats_loyalty';
const CLASS_ID = `${ISSUER_ID}.${CLASS_SUFFIX}`;

/**
 * Genera la URL "Save to Google Wallet" para un cliente.
 * Google Wallet usa JWTs firmados con la clave privada del service account.
 */
export function buildGoogleWalletUrl(clientId: string, clientName: string, stamps: number): string {
  if (!ISSUER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Google Wallet no está configurado (Faltan GOOGLE_ISSUER_ID o GOOGLE_SERVICE_ACCOUNT_EMAIL)');
  }

  const assetsDir = path.join(process.cwd(), 'wallet-assets', 'apple.pass');
  let privateKey: string;

  try {
    privateKey = fs.readFileSync(path.join(assetsDir, 'google_private.pem'), 'utf8');
  } catch {
    const base64Key = process.env.GOOGLE_PRIVATE_KEY_BASE64 || '';
    privateKey = Buffer.from(base64Key, 'base64').toString('utf8');
  }

  if (!privateKey) {
    throw new Error('No se encontró la clave privada de Google Wallet');
  }

  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, 10));
  const objectId = `${ISSUER_ID}.${clientId.replace(/-/g, '_')}`;

  const loyaltyObject = {
    id: objectId,
    classId: CLASS_ID,
    state: 'ACTIVE',
    accountId: clientId,
    accountName: clientName,
    loyaltyPoints: {
      label: 'Sellos',
      balance: {
        int: safeStamps,
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: clientId,
      alternateText: clientId,
    },
    heroImage: {
      sourceUri: {
        uri: `${process.env.SERVER_URL || 'https://api.urbaneats.example.com'}/api/loyalty/assets/strip@2x.png`,
      },
      contentDescription: {
        defaultValue: {
          language: 'es',
          value: 'Urban Eats Rewards',
        },
      },
    },
    textModulesData: [
      {
        header: 'PRÓXIMO PREMIO',
        body: safeStamps >= 10 ? '¡PERRO GRATIS!' : safeStamps >= 5 ? '¡25% OFF disponible!' : `Faltan ${5 - safeStamps} sellos para 25% OFF`,
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
      sourceUri: {
        uri: `${process.env.SERVER_URL || 'https://api.urbaneats.example.com'}/api/loyalty/assets/logo.jpeg`,
      },
      contentDescription: {
        defaultValue: {
          language: 'es',
          value: 'Urban Eats Logo',
        },
      },
    },
    hexBackgroundColor: '#0f1115',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX',
    locations: [
      {
        latitude: 19.4326,
        longitude: -99.1332,
      },
    ],
  };

  const claims = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    aud: 'google',
    origins: [process.env.SERVER_URL || 'https://api.urbaneats.example.com'],
    typ: 'savetowallet',
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  const token = jwt.sign(claims, privateKey, { algorithm: 'ES256' });

  return `https://pay.google.com/gp/v/save/${token}`;
}
