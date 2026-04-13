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

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    serialNumber: cardId,
    organizationName: 'Urban Eats',
    description: 'Urban Eats Rewards',
    logoText: 'Urban Eats',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(15, 17, 21)',
    labelColor: 'rgb(255, 184, 0)',
    storeCard: {
      headerFields: [],
      primaryFields: [
        { key: 'stamps', label: 'SELLOS', value: `${stamps} / 10` },
      ],
      secondaryFields: [
        { key: 'client', label: 'MIEMBRO', value: clientName },
      ],
      auxiliaryFields: [
        {
          key: 'reward',
          label: 'PRÓXIMO PREMIO',
          value: stamps >= 10 ? '¡PERRO GRATIS!' : '25% OFF al Sello 5',
        },
      ],
      backFields: [
        {
          key: 'terms',
          label: 'TÉRMINOS',
          value: 'Válido en la sucursal. Los hot dogs gratis no aplican en otras promos.',
        },
      ],
    },
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: cardId,
      messageEncoding: 'iso-8859-1',
    },
  };

  buffers['pass.json'] = Buffer.from(JSON.stringify(passJson));

  let signerCert: Buffer | string;
  let signerKey: Buffer | string;
  let wwdr: Buffer | string;

  try {
    signerCert = fs.readFileSync(path.join(assetsDir, 'pass.pem'));
    signerKey = fs.readFileSync(path.join(assetsDir, 'pass.key'), 'utf8');
    wwdr = fs.readFileSync(path.join(assetsDir, 'wwdr_rsa.pem'));
  } catch {
    signerCert = Buffer.from(process.env.APPLE_SIGNER_CERT_BASE64 || '', 'base64');
    signerKey = Buffer.from(process.env.APPLE_SIGNER_KEY_BASE64 || '', 'base64').toString('utf8');
    wwdr = Buffer.from(process.env.APPLE_WWDR_CERT_BASE64 || '', 'base64');
  }

  const pass = new PKPass(buffers, { signerCert, signerKey, wwdr });
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
