import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/loyalty/lookup — Busca clientId por teléfono + country_code
export async function POST(request: NextRequest) {
  try {
    const { phone, country_code } = await request.json();

    if (!phone || !country_code) {
      return NextResponse.json(
        { error: 'Teléfono y país son requeridos.' },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      'SELECT id FROM clients WHERE phone = $1 AND country_code = $2 LIMIT 1',
      [phone, country_code]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No encontramos una tarjeta con ese número.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ clientId: rows[0].id });
  } catch (err: any) {
    console.error('[Lookup] Error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
