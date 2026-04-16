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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ rewardId: string }> }
) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { rewardId } = await params;
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const key of ['stamp_number', 'type', 'value', 'description', 'active']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }
    values.push(rewardId, a.businessId);

    const { rows } = await pool.query(
      `UPDATE rewards SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING id, stamp_number, type, value, description, active`,
      values
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rewardId: string }> }
) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { rewardId } = await params;
    await pool.query('DELETE FROM rewards WHERE id = $1 AND business_id = $2', [rewardId, a.businessId]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
