import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { ensureProductsSeeded } from '@/lib/seed-products';

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

// GET /api/admin/products — Lista del catálogo con stock vivo
export async function GET(request: NextRequest) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await ensureProductsSeeded();

  const { rows } = await pool.query(
    `SELECT id, category_key, category_name, category_color, name,
            cost::float AS cost, price::float AS price, stock,
            is_ramen, is_service, active
     FROM products
     WHERE business_id = $1
     ORDER BY category_key, name`,
    [a.businessId]
  );

  return NextResponse.json(rows);
}

// POST /api/admin/products — Crear producto custom (opcional, no parte del catálogo)
export async function POST(request: NextRequest) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const required = ['id', 'category_key', 'category_name', 'category_color', 'name', 'cost', 'price'];
    for (const k of required) if (body[k] === undefined) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });

    await pool.query(
      `INSERT INTO products (id, business_id, category_key, category_name, category_color,
                              name, cost, price, stock, is_ramen, is_service, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
      [
        body.id,
        a.businessId,
        body.category_key,
        body.category_name,
        body.category_color,
        body.name,
        body.cost,
        body.price,
        body.stock ?? 0,
        body.is_ramen ?? false,
        body.is_service ?? false,
      ]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
