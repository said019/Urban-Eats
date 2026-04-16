import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

function auth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  try {
    jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// POST /api/admin/wallet-sync/:clientId — Fuerza push + Google update sin cambiar sellos
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { clientId } = await params;
    const { rows } = await pool.query('SELECT name, stamps FROM clients WHERE id = $1', [clientId]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { name, stamps } = rows[0];
    await notifyStampChange(clientId, name, stamps, {
      alert: {
        title: 'Urban Eats Rewards',
        body: `Tarjeta sincronizada · ${stamps} de 10 sellos`,
      },
    });

    const deviceCount = await pool.query(
      'SELECT COUNT(*)::int AS n FROM apple_wallet_devices WHERE loyalty_card_id = $1',
      [clientId]
    );

    return NextResponse.json({
      success: true,
      devices: deviceCount.rows[0].n,
      stamps,
    });
  } catch (err: any) {
    console.error('[Wallet Sync] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
