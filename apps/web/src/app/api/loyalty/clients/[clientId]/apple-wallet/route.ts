import { NextRequest, NextResponse } from 'next/server';
import { PKPass } from 'passkit-generator';
import path from 'path';
import fs from 'fs';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

async function buildApplePassBuffer(cardId: string, clientName: string, stamps: number) {
  if (!process.env.APPLE_TEAM_ID || !process.env.APPLE_PASS_TYPE_ID) {
    throw new Error('Apple Wallet no está configurado (Faltan ENV vars)');
  }

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
  for (const suffix of ['', '@2x', '@3x']) {
    const stampFile = `stamp-strip-${safeStamps}${suffix}.png`;
    const passFile = `strip${suffix}.png`;
    if (buffers[stampFile]) {
      buffers[passFile] = buffers[stampFile];
    }
  }

  const firstName = (clientName || '').trim().split(/\s+/)[0] || clientName;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    serialNumber: cardId,
    organizationName: 'Urban Eats',
    description: 'Urban Eats Rewards',
    logoText: 'Urban Eats',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(26, 15, 5)',
    labelColor: 'rgb(255, 138, 0)',
    storeCard: {
      headerFields: [
        { key: 'member', label: 'MIEMBRO', value: firstName },
      ],
      primaryFields: [],
      secondaryFields: [
        { key: 'stamps', label: 'SELLOS', value: `${stamps} / 10`, textAlignment: 'PKTextAlignmentLeft' },
        {
          key: 'reward',
          label: 'PRÓXIMO PREMIO',
          value: stamps >= 10 ? '¡PERRO GRATIS! 🌭' : stamps >= 5 ? '25% OFF disponible' : `Faltan ${5 - stamps} para 25% OFF`,
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      auxiliaryFields: [],
      backFields: [
        {
          key: 'howto',
          label: 'CÓMO FUNCIONA',
          value: 'Acumula 1 sello por cada compra. Al llegar a 5 sellos obtienes 25% OFF. Al llegar a 10 sellos un Perro GRATIS!',
        },
        {
          key: 'terms',
          label: 'TÉRMINOS',
          value: 'Válido en sucursal Urban Eats. Los hot dogs gratis no se combinan con otras promociones. Tarjeta personal e intransferible.',
        },
      ],
    },
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: cardId,
      messageEncoding: 'iso-8859-1',
      altText: firstName,
    },
  };

  buffers['pass.json'] = Buffer.from(JSON.stringify(passJson));

  const resolveCert = (envPath: string | undefined, base64Env: string | undefined, defaultFile: string) => {
    const candidatePaths = [
      envPath && path.isAbsolute(envPath) ? envPath : null,
      envPath ? path.join(process.cwd(), envPath) : null,
      path.join(assetsDir, defaultFile),
    ].filter(Boolean) as string[];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }

    const b64 = base64Env || '';
    if (b64) return Buffer.from(b64, 'base64');
    throw new Error(`No se encontró ${defaultFile} ni en disco ni en ENV`);
  };

  const signerCert = resolveCert(process.env.APPLE_PASS_CERT, process.env.APPLE_SIGNER_CERT_BASE64, 'pass.pem');
  const signerKey = resolveCert(process.env.APPLE_PASS_KEY, process.env.APPLE_SIGNER_KEY_BASE64, 'pass.key').toString('utf8');
  const wwdr = resolveCert(process.env.APPLE_WWDR, process.env.APPLE_WWDR_CERT_BASE64, 'wwdr_rsa.pem');

  const signerKeyPassphrase = process.env.APPLE_CERT_PASSWORD;
  const pass = new PKPass(buffers, {
    signerCert,
    signerKey,
    wwdr,
    ...(signerKeyPassphrase ? { signerKeyPassphrase } : {}),
  });
  return pass.getAsBuffer();
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
    const passBuffer = await buildApplePassBuffer(client.id, client.name, client.stamps);

    return new NextResponse(new Uint8Array(passBuffer), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${client.name}_Urban_Eats.pkpass"`,
      },
    });
  } catch (err: any) {
    console.error('[Apple Wallet] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Error generando el pase de Apple Wallet' },
      { status: 500 }
    );
  }
}
