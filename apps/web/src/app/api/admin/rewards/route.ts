import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

function auth(req: NextRequest): { businessId: string } | null {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    return { businessId: payload.businessId };
  } catch {
    return null;
  }
}

// GET /api/admin/rewards
export async function GET(request: NextRequest) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { rows } = await pool.query(
    'SELECT id, stamp_number, type, value, description, active FROM rewards WHERE business_id = $1 ORDER BY stamp_number ASC',
    [a.businessId]
  );
  return NextResponse.json(rows);
}

// POST /api/admin/rewards
export async function POST(request: NextRequest) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { stamp_number, type, value, description, active } = await request.json();
    if (!stamp_number || !type || !value) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO rewards (business_id, stamp_number, type, value, description, active)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
       RETURNING id, stamp_number, type, value, description, active`,
      [a.businessId, stamp_number, type, value, description || '', active]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
