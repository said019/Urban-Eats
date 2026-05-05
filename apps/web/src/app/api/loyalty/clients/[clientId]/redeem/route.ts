import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

const MAX_STAMPS = 6;

// POST /api/loyalty/clients/[clientId]/redeem — Canjear ramen gratis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { type } = await request.json();

    const clientQuery = await pool.query('SELECT name, stamps FROM clients WHERE id = $1', [clientId]);
    if (clientQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { name, stamps } = clientQuery.rows[0];

    if ((type === 'free' || type === 'free_item' || type === 'discount') && stamps >= MAX_STAMPS) {
      // Resta MAX_STAMPS (no resetea a 0) — así si ya tenía 7, queda con 1 hacia el siguiente ramen.
      const newStamps = Math.max(0, stamps - MAX_STAMPS);
      await pool.query('UPDATE clients SET stamps = $1 WHERE id = $2', [newStamps, clientId]);
      notifyStampChange(clientId, name, newStamps, {
        alert: {
          title: 'Bunsik Rewards',
          body: '¡Canjeaste tu ramen gratis! 🍜 Sigue sumando para el siguiente.',
        },
      }).catch((err) => console.error('[Redeem] Notify error:', err));
      return NextResponse.json({
        success: true,
        newStamps,
        message: '¡Ramen gratis canjeado! 🍜',
        reset: true,
      });
    }

    return NextResponse.json({
      error: `Necesitas ${MAX_STAMPS} sellos para canjear un ramen gratis`,
    }, { status: 400 });
  } catch (err: any) {
    console.error('[Loyalty API] Redeem error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
