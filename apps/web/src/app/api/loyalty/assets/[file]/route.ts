import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Sirve las imágenes públicas del pase (strip/logo/icon) desde wallet-assets.
// Google Wallet descarga heroImage desde esta URL al crear/actualizar la
// tarjeta; si responde 404 el PATCH completo falla y los sellos no se
// actualizan en Android.
export const dynamic = 'force-dynamic';

const ASSETS_DIR = path.join(process.cwd(), 'wallet-assets', 'apple.pass');

// Allowlist estricta: el directorio también contiene llaves privadas y
// certificados de firma — solo se exponen imágenes con estos nombres.
const ALLOWED = /^(strip|logo|icon|stamp-strip-\d)(@[23]x)?\.(png|jpe?g)$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!ALLOWED.test(file)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  try {
    const buf = fs.readFileSync(path.join(ASSETS_DIR, file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': file.endsWith('.png') ? 'image/png' : 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
}
