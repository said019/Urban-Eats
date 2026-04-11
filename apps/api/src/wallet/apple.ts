import { PKPass } from 'passkit-generator';
import jwt from 'jsonwebtoken';
import http2 from 'http2';
import path from 'path';
import fs from 'fs';

/**
 * Genera el Buffer de un iPhone Pass (.pkpass)
 */
export async function buildApplePassBuffer(cardId: string, clientName: string, stamps: number) {
  if (!process.env.APPLE_TEAM_ID || !process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_APNS_KEY_BASE64) {
    throw new Error("Apple Wallet no está configurado (Faltan ENV vars)");
  }

  // Leer imágenes de wallet-assets
  const assetsDir = path.join(process.cwd(), 'wallet-assets', 'apple.pass');
  const buffers: { [key: string]: Buffer } = {};

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        buffers[file] = fs.readFileSync(path.join(assetsDir, file));
      }
    }
  }

  // Seleccionar strip dinámico según cantidad de sellos
  const safeStamps = Math.max(0, Math.min(Number(stamps) || 0, 10));
  const stripSuffixes = ['', '@2x', '@3x'];
  for (const suffix of stripSuffixes) {
    const stampFile = `stamp-strip-${safeStamps}${suffix}.png`;
    const passFile = `strip${suffix}.png`;
    if (buffers[stampFile]) {
      buffers[passFile] = buffers[stampFile];
    }
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    serialNumber: cardId,
    organizationName: "Urban Eats",
    description: "Urban Eats Rewards",
    logoText: "Urban Eats",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(15, 17, 21)",
    labelColor: "rgb(255, 184, 0)", // Yellow brand
    webServiceURL: `${process.env.SERVER_URL || 'https://api.urbaneats.example.com'}/api/wallet`,
    authenticationToken: process.env.APPLE_AUTH_TOKEN || "SECURE_TOKEN_PLACEHOLDER",
    storeCard: {
      headerFields: [],
      primaryFields: [
        {
          key: "stamps",
          label: "SELLOS",
          value: `${stamps} / 10`,
          changeMessage: "¡Tienes %@ sellos!" 
        }
      ],
      secondaryFields: [
        { key: "client", label: "MIEMBRO", value: clientName }
      ],
      auxiliaryFields: [
        { key: "reward", label: "PRÓXIMO PREMIO", value: stamps >= 10 ? "¡PERRO GRATIS!" : "25% OFF al Sello 5" }
      ],
      backFields: [
        { key: "terms", label: "TÉRMINOS", value: "Válido en la sucursal. Los hot dogs gratis no aplican en otras promos." },
        { key: "lastNotification", label: "ÚLTIMA NOTIFICACIÓN", value: "¡Bienvenido a Urban Eats!", changeMessage: "%@" }
      ]
    },
    locations: [{ latitude: 19.4326, longitude: -99.1332, relevantText: "¡Estás cerca de Urban Eats! Canjea un Hot Dog." }],
    barcode: {
      format: "PKBarcodeFormatQR",
      message: cardId,
      messageEncoding: "iso-8859-1"
    }
  };

  // Asignar el JSON a los buffers parseados
  buffers["pass.json"] = Buffer.from(JSON.stringify(passJson));

  let signerCert: Buffer | string;
  let signerKey: Buffer | string;
  let wwdr: Buffer | string;

  try {
    signerCert = fs.readFileSync(path.join(assetsDir, 'pass.pem'));
    signerKey = fs.readFileSync(path.join(assetsDir, 'pass.key'), 'utf8');
    wwdr = fs.readFileSync(path.join(assetsDir, 'wwdr_rsa.pem'));
  } catch (err) {
    // Fallback a Base64 ENV
    signerCert = Buffer.from(process.env.APPLE_SIGNER_CERT_BASE64 || '', 'base64');
    signerKey = Buffer.from(process.env.APPLE_SIGNER_KEY_BASE64 || '', 'base64').toString('utf8');
    wwdr = Buffer.from(process.env.APPLE_WWDR_CERT_BASE64 || '', 'base64');
  }

  const pass = new PKPass(buffers, { signerCert, signerKey, wwdr });

  return pass.getAsBuffer();
}

/**
 * Envía la notificación APNs (Push Notification silenciosa o alerta)
 */
export async function sendAPNsAlertNotification(pushToken: string, pushType: 'alert'|'background' = 'alert', title?: string, body?: string) {
  if (!process.env.APPLE_KEY_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APNS_KEY_BASE64) {
    console.log("[APNs] Credenciales de entorno incompletas.");
    return false;
  }

  const p8Key = Buffer.from(process.env.APPLE_APNS_KEY_BASE64, 'base64').toString('ascii');
  
  const token = jwt.sign(
    { iss: process.env.APPLE_TEAM_ID, iat: Math.floor(Date.now() / 1000) },
    p8Key,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: process.env.APPLE_KEY_ID } as any }
  );

  return new Promise<boolean>((resolve) => {
    const isProd = true; // or false for sandbox
    const host = isProd ? 'api.push.apple.com' : 'api.development.push.apple.com';
    
    const client = http2.connect(`https://${host}`);
    
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'authorization': `bearer ${token}`,
      'apns-topic': process.env.APPLE_PASS_TYPE_ID,
      'apns-push-type': pushType,
      'apns-priority': pushType === 'background' ? '5' : '10',
    });

    if (pushType === 'alert' && title && body) {
       req.write(JSON.stringify({ aps: { alert: { title, body } } }));
    } else {
       req.write(JSON.stringify({ aps: {} })); // empty payload triggers pass update
    }

    req.on('response', (headers) => {
      const status = headers[':status'];
      client.close();
      resolve(status === 200);
    });
    
    req.on('error', () => {
      client.close();
      resolve(false);
    });

    req.end();
  });
}
