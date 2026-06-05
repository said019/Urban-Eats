import { PKPass } from 'passkit-generator';
import path from 'path';
import fs from 'fs';
import http2 from 'http2';
import jwt from 'jsonwebtoken';
import { buildWalletQrValue } from './wallet-qr';

const AUTH_TOKEN = process.env.APPLE_AUTH_TOKEN || 'URBAN_EATS_WALLET_TOKEN';

export function getAuthToken(): string {
  return AUTH_TOKEN;
}

export function assetsDir(): string {
  return path.join(process.cwd(), 'wallet-assets', 'apple.pass');
}

function resolveCert(envPath: string | undefined, base64Env: string | undefined, defaultFile: string): Buffer {
  const dir = assetsDir();
  const candidatePaths = [
    envPath && path.isAbsolute(envPath) ? envPath : null,
    envPath ? path.join(process.cwd(), envPath) : null,
    path.join(dir, defaultFile),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }

  const b64 = base64Env || '';
  if (b64) return Buffer.from(b64, 'base64');
  throw new Error(`No se encontró ${defaultFile} ni en disco ni en ENV`);
}

export async function buildApplePassBuffer(cardId: string, clientName: string, stamps: number) {
  if (!process.env.APPLE_TEAM_ID || !process.env.APPLE_PASS_TYPE_ID) {
    throw new Error('Apple Wallet no está configurado (Faltan ENV vars)');
  }

  const dir = assetsDir();
  const buffers: { [key: string]: Buffer } = {};

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        buffers[file] = fs.readFileSync(path.join(dir, file));
      }
    }
  }

  // Dynamic strip according to stamps
  const MAX_STAMPS = 6;
  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, MAX_STAMPS));
  for (const suffix of ['', '@2x', '@3x']) {
    const stampFile = `stamp-strip-${safeStamps}${suffix}.png`;
    const passFile = `strip${suffix}.png`;
    if (buffers[stampFile]) {
      buffers[passFile] = buffers[stampFile];
    }
  }

  const firstName = (clientName || '').trim().split(/\s+/)[0] || clientName;
  const serverUrl = process.env.SERVER_URL || 'https://urban-eats-production.up.railway.app';
  const qrValue = buildWalletQrValue(cardId, serverUrl);
  const qrBarcode = {
    format: 'PKBarcodeFormatQR',
    message: qrValue,
    messageEncoding: 'iso-8859-1',
    altText: 'Escanear para sello',
  };

  const remaining = Math.max(0, MAX_STAMPS - safeStamps);
  const rewardValue = safeStamps >= MAX_STAMPS
    ? '¡RAMEN GRATIS! 🍜'
    : remaining === 1
    ? '¡Falta 1 ramen!'
    : `Faltan ${remaining} ramens`;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    serialNumber: cardId,
    organizationName: 'Bunsik Ramen',
    description: 'Bunsik Rewards',
    logoText: 'BUNSIK RAMEN',
    foregroundColor: 'rgb(253, 232, 244)',     // pink-50 text
    backgroundColor: 'rgb(131, 24, 67)',       // pink-900 deep magenta
    labelColor: 'rgb(255, 200, 220)',          // soft pink labels
    webServiceURL: `${serverUrl}/api/wallet`,
    authenticationToken: AUTH_TOKEN,
    storeCard: {
      headerFields: [
        { key: 'member', label: 'MIEMBRO', value: firstName },
      ],
      primaryFields: [],
      secondaryFields: [
        {
          key: 'stamps',
          label: 'SELLOS',
          value: `${safeStamps} / ${MAX_STAMPS}`,
          textAlignment: 'PKTextAlignmentLeft',
          changeMessage: '¡Llevas %@ ramens! 🍜',
        },
        {
          key: 'reward',
          label: 'PRÓXIMO PREMIO',
          value: rewardValue,
          textAlignment: 'PKTextAlignmentRight',
          changeMessage: '%@',
        },
      ],
      auxiliaryFields: [],
      backFields: [
        {
          key: 'howto',
          label: 'CÓMO FUNCIONA',
          value:
            `Compra ${MAX_STAMPS} ramens y el siguiente va por la casa 🍜.\n\n` +
            'Cada vez que pidas ramen en Bunsik Ramen, suma 1 sello automáticamente. Al llegar a tu meta, canjéalo en caja con tu tarjeta digital.',
        },
        {
          key: 'social',
          label: 'SÍGUENOS',
          value:
            'Instagram: @doriperros_\n' +
            'WhatsApp: chat.whatsapp.com/G8BmDSK06lL16s1zzx7b93',
        },
        {
          key: 'terms',
          label: 'TÉRMINOS',
          value:
            'Válido en sucursal Bunsik Ramen. El ramen gratis no se combina con otras promociones. Tarjeta personal e intransferible. Bunsik Ramen se reserva el derecho de modificar el programa en cualquier momento.',
        },
      ],
    },
    barcode: qrBarcode,
    barcodes: [qrBarcode],
  };

  buffers['pass.json'] = Buffer.from(JSON.stringify(passJson));

  const signerCert = resolveCert(
    process.env.APPLE_PASS_CERT,
    process.env.APPLE_SIGNER_CERT_BASE64,
    'pass.pem'
  );
  const signerKey = resolveCert(
    process.env.APPLE_PASS_KEY,
    process.env.APPLE_SIGNER_KEY_BASE64,
    'pass.key'
  ).toString('utf8');
  const wwdr = resolveCert(
    process.env.APPLE_WWDR,
    process.env.APPLE_WWDR_CERT_BASE64,
    'wwdr_rsa.pem'
  );

  const signerKeyPassphrase = process.env.APPLE_CERT_PASSWORD;
  const pass = new PKPass(buffers, {
    signerCert,
    signerKey,
    wwdr,
    ...(signerKeyPassphrase ? { signerKeyPassphrase } : {}),
  });
  return pass.getAsBuffer();
}

/**
 * Send APNs push to a device. Returns true on 200, false otherwise (410 → token invalid).
 */
export async function sendWalletPush(
  pushToken: string,
  opts: { alert?: { title: string; body: string } } = {}
): Promise<{ ok: boolean; status: number }> {
  if (
    !process.env.APPLE_KEY_ID ||
    !process.env.APPLE_TEAM_ID ||
    !process.env.APPLE_APNS_KEY_BASE64
  ) {
    console.warn('[APNs] Credenciales incompletas, saltando push.');
    return { ok: false, status: 0 };
  }

  const p8Key = Buffer.from(process.env.APPLE_APNS_KEY_BASE64, 'base64').toString('ascii');

  const token = jwt.sign(
    { iss: process.env.APPLE_TEAM_ID, iat: Math.floor(Date.now() / 1000) },
    p8Key,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: process.env.APPLE_KEY_ID } as any }
  );

  const pushType = opts.alert ? 'alert' : 'background';
  const payload = opts.alert
    ? JSON.stringify({ aps: { alert: opts.alert, sound: 'default' } })
    : '{}';

  return new Promise((resolve) => {
    const client = http2.connect('https://api.push.apple.com');

    client.on('error', () => {
      try { client.close(); } catch {}
      resolve({ ok: false, status: -1 });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'authorization': `bearer ${token}`,
      'apns-topic': process.env.APPLE_PASS_TYPE_ID,
      'apns-push-type': pushType,
      'apns-priority': pushType === 'background' ? '5' : '10',
    });

    let status = 0;
    req.on('response', (headers) => {
      status = (headers[':status'] as number) || 0;
    });
    req.on('end', () => {
      try { client.close(); } catch {}
      resolve({ ok: status === 200, status });
    });
    req.on('error', () => {
      try { client.close(); } catch {}
      resolve({ ok: false, status: -1 });
    });

    req.write(payload);
    req.end();
  });
}
