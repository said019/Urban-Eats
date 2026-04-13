import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// POST /api/admin/stamp/[clientId] — Agregar sello
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Verificar JWT
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

    const clientQuery = await pool.query('SELECT stamps FROM clients WHERE id = $1', [clientId]);
    if (clientQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const currentStamps = clientQuery.rows[0].stamps;
    if (currentStamps >= 10) {
      return NextResponse.json({ error: 'El cliente ya tiene los 10 sellos.' }, { status: 400 });
    }

    const { rows } = await pool.query(
      'UPDATE clients SET stamps = stamps + 1 WHERE id = $1 RETURNING stamps',
      [clientId]
    );

    return NextResponse.json({ success: true, newStamps: rows[0].stamps });
  } catch (err: any) {
    console.error('[Admin API] Stamp error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
