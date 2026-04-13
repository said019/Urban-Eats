import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST /api/loyalty/clients/[clientId]/redeem — Canjear recompensa
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { type } = await request.json();

    const clientQuery = await pool.query('SELECT stamps FROM clients WHERE id = $1', [clientId]);
    if (clientQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const stamps = clientQuery.rows[0].stamps;

    if (type === 'discount' && stamps >= 5) {
      return NextResponse.json({ success: true, reward: '25% de descuento en tu siguiente compra' });
    } else if (type === 'free_item' && stamps >= 10) {
      await pool.query('UPDATE clients SET stamps = 0 WHERE id = $1', [clientId]);
      return NextResponse.json({ success: true, reward: 'Mini Perro Gratis', reset: true });
    }

    return NextResponse.json({ error: 'No cumples los sellos requeridos' }, { status: 400 });
  } catch (err: any) {
    console.error('[Loyalty API] Redeem error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
