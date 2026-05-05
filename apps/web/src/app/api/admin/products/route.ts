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

// GET /api/admin/products — lista del catálogo con stock vivo (JOIN con categories)
export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT p.id, p.category_id,
            c.name AS category_name, c.color AS category_color,
            c.is_ramen AS is_ramen,
            p.name, p.cost::float AS cost, p.price::float AS price,
            p.stock, p.is_service, p.is_active
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
     ORDER BY c.sort_order, p.name`
  );

  return NextResponse.json(rows);
}

// POST /api/admin/products — Crear producto custom
export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    for (const k of ['id', 'category_id', 'name', 'cost', 'price']) {
      if (body[k] === undefined) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO products (id, category_id, name, cost, price, stock, is_service, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [body.id, body.category_id, body.name, body.cost, body.price, body.stock ?? 0, body.is_service ?? false]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
