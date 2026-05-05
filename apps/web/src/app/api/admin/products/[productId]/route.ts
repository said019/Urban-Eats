import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

export const dynamic = 'force-dynamic';

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

// PATCH /api/admin/products/:id
// Body: { price?, cost?, name?, is_active?, stock?, stock_delta?, reference?, notes? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { productId } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of ['price', 'cost', 'name', 'is_active']) {
      if (body[key] !== undefined) { fields.push(`${key} = $${idx++}`); values.push(body[key]); }
    }

    let stockChange: { previous: number; next: number } | null = null;
    if (typeof body.stock === 'number' || typeof body.stock_delta === 'number') {
      const cur = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }
      const previous = cur.rows[0].stock;
      const next = typeof body.stock === 'number' ? body.stock : Math.max(0, previous + body.stock_delta);
      fields.push(`stock = $${idx++}`);
      values.push(next);
      stockChange = { previous, next };
    }

    if (fields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    fields.push('updated_at = now()');
    values.push(productId);

    const { rows } = await client.query(
      `UPDATE products SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, category_id, name,
                 cost::float AS cost, price::float AS price, stock,
                 is_service, is_active`,
      values
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    if (stockChange) {
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous, new_stock, reference, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          productId,
          'adjustment',
          stockChange.next - stockChange.previous,
          stockChange.previous,
          stockChange.next,
          body.reference ?? null,
          body.notes ?? null,
        ]
      );
    }

    await client.query('COMMIT');

    // Pull category info for the UI
    const enriched = await pool.query(
      `SELECT p.id, p.category_id, c.name AS category_name, c.color AS category_color,
              c.is_ramen, p.name, p.cost::float AS cost, p.price::float AS price,
              p.stock, p.is_service, p.is_active
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [productId]
    );
    return NextResponse.json(enriched.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
