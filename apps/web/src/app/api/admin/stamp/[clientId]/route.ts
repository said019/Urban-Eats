import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';
const MAX_STAMPS = 6;
const STAMP_HARD_CAP = 12; // Permite acumular un poco más allá de la meta para no perder sellos durante una compra grande.

// POST /api/admin/stamp/[clientId] — Agregar sello
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Falta Token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Token Inválido' }, { status: 401 });
    }

    const clientQuery = await pool.query('SELECT name, stamps FROM clients WHERE id = $1', [clientId]);
    if (clientQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { name, stamps: currentStamps } = clientQuery.rows[0];
    if (currentStamps >= STAMP_HARD_CAP) {
      return NextResponse.json({
        error: `El cliente ya tiene ${currentStamps} sellos. Canjea su ramen gratis antes de seguir sumando.`,
      }, { status: 400 });
    }

    const { rows } = await pool.query(
      `UPDATE clients
       SET stamps = LEAST(stamps + 1, $2),
           last_visit_at = now(),
           total_visits = COALESCE(total_visits, 0) + 1
       WHERE id = $1
       RETURNING stamps`,
      [clientId, STAMP_HARD_CAP]
    );
    const newStamps = rows[0].stamps;
    const reachedReward = currentStamps < MAX_STAMPS && newStamps >= MAX_STAMPS;

    // Trigger wallet updates (no await to respond faster, runs in background)
    notifyStampChange(clientId, name, newStamps, {
      alert: {
        title: 'Bunsik Rewards',
        body: reachedReward
          ? '¡Completaste tu tarjeta! Tu próximo ramen va por la casa 🍜'
          : `Nuevo sello · ${newStamps} / ${MAX_STAMPS} ramens 🍜`,
      },
    }).catch((err) => console.error('[Stamp] Notify error:', err));

    return NextResponse.json({ success: true, newStamps });
  } catch (err: any) {
    console.error('[Admin API] Stamp error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
