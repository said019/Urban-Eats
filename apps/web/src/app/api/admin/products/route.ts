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

// Paleta para categorías nuevas (tonos que combinan con el tema del POS).
const CATEGORY_PALETTE = ['#A855F7', '#6366F1', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#EC4899'];

// Convierte un nombre en un id estable (sin acentos, minúsculas, guion bajo).
function slugify(input: string, max = 30): string {
  const base = input
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
  return base || 'item';
}

// Color determinista a partir del id, para que la misma categoría siempre
// reciba el mismo color.
function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}

// POST /api/admin/products — Crear producto o servicio.
//   - El id (slug) se genera solo a partir del nombre; el cajero nunca lo ve.
//   - Acepta `category_id` existente o `new_category: { name }` para crear una
//     categoría nueva (is_ramen = false → no otorga sellos de lealtad).
//   - Es un INSERT: no borra nada. Categoría + producto en una transacción.
export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: {
    name?: string;
    price?: number | string;
    cost?: number | string;
    stock?: number | string;
    is_service?: boolean;
    category_id?: string;
    new_category?: { name?: string } | null;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  if (name.length > 150) return NextResponse.json({ error: 'El nombre es demasiado largo' }, { status: 400 });

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });

  const cost = body.cost === undefined || body.cost === null || body.cost === '' ? 0 : Number(body.cost);
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ error: 'Costo inválido' }, { status: 400 });

  const isService = body.is_service === true;
  // Los servicios no manejan stock; se fija en 0 (el POS los trata como ilimitados).
  let stock = 0;
  if (!isService) {
    stock = body.stock === undefined || body.stock === null || body.stock === '' ? 0 : Math.floor(Number(body.stock));
    if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ error: 'Stock inválido' }, { status: 400 });
  }

  const newCategoryName = body.new_category && typeof body.new_category.name === 'string' ? body.new_category.name.trim() : '';
  if (!body.category_id && !newCategoryName) {
    return NextResponse.json({ error: 'Falta la categoría' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let categoryId: string;
    if (newCategoryName) {
      categoryId = slugify(newCategoryName, 40);
      await client.query(
        `INSERT INTO categories (id, name, color, is_ramen, sort_order)
         VALUES ($1, $2, $3, false, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))
         ON CONFLICT (id) DO NOTHING`,
        [categoryId, newCategoryName.slice(0, 100), pickColor(categoryId)]
      );
    } else {
      categoryId = String(body.category_id);
      const cat = await client.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
      if (cat.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'La categoría no existe' }, { status: 400 });
      }
    }

    const productId = `${slugify(name)}_${Date.now().toString(36)}`;

    await client.query(
      `INSERT INTO products (id, category_id, name, cost, price, stock, is_service, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [productId, categoryId, name, cost, price, stock, isService]
    );

    await client.query('COMMIT');

    // Devuelve el producto con su categoría (misma forma que GET) para que la UI
    // lo agregue sin recargar todo.
    const enriched = await pool.query(
      `SELECT p.id, p.category_id, c.name AS category_name, c.color AS category_color,
              c.is_ramen, p.name, p.cost::float AS cost, p.price::float AS price,
              p.stock, p.is_service, p.is_active
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [productId]
    );
    return NextResponse.json(enriched.rows[0], { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
