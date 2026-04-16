import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

// POST /api/loyalty/clients/[clientId]/redeem — Canjear recompensa
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

    if ((type === 'discount') && stamps >= 5) {
      // El descuento es un milestone; no resetea ni consume sellos
      return NextResponse.json({
        success: true,
        newStamps: stamps,
        message: '25% de descuento aplicado. ¡Sigue sumando para tu Perro Gratis!',
      });
    }

    if ((type === 'free' || type === 'free_item') && stamps >= 10) {
      await pool.query('UPDATE clients SET stamps = 0 WHERE id = $1', [clientId]);
      notifyStampChange(clientId, name, 0, {
        alert: {
          title: 'Urban Eats Rewards',
          body: '¡Canjeaste tu Perro Gratis! Tarjeta reiniciada.',
        },
      }).catch((err) => console.error('[Redeem] Notify error:', err));
      return NextResponse.json({
        success: true,
        newStamps: 0,
        message: '¡Perro Gratis canjeado! Tarjeta reiniciada.',
        reset: true,
      });
    }

    return NextResponse.json({ error: 'No cumples los sellos requeridos' }, { status: 400 });
  } catch (err: any) {
    console.error('[Loyalty API] Redeem error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
