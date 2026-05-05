import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

export const dynamic = 'force-dynamic';

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

// PATCH /api/admin/products/:id — actualizar precio/stock/active.
// Body soporta: { price, stock, stock_delta, cost, name, active }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { productId } = await params;
    const body = await request.json();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of ['price', 'cost', 'name', 'active']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }
    if (typeof body.stock === 'number') {
      fields.push(`stock = $${idx++}`);
      values.push(body.stock);
    } else if (typeof body.stock_delta === 'number') {
      fields.push(`stock = GREATEST(0, stock + $${idx++})`);
      values.push(body.stock_delta);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }
    fields.push('updated_at = now()');
    values.push(productId, a.businessId);

    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(', ')}
       WHERE id = $${idx++} AND business_id = $${idx}
       RETURNING id, category_key, category_name, category_color, name,
                 cost::float AS cost, price::float AS price, stock,
                 is_ramen, is_service, active`,
      values
    );

    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('[Products PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
