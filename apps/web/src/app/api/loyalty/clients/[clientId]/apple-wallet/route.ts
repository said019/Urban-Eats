import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { buildApplePassBuffer } from '@/lib/apple-wallet';

export const dynamic = 'force-dynamic';

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
