import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';
const MAX_STAMPS = 6;
const STAMP_HARD_CAP = 12;

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

type IncomingItem = { product_id: string; qty: number };
type IncomingSale = {
  client_uuid?: string | null;       // wallet client UUID
  client_name?: string | null;
  payment_method: string;
  items: IncomingItem[];
  use_reward?: boolean;
};

// POST /api/admin/sales — venta atómica (POS).
// Mantiene wallet (clients UUID) + reporte (sales BIGINT).
export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: IncomingSale;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 });
  }
  if (!body.payment_method) {
    return NextResponse.json({ error: 'Método de pago requerido' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock products
    const ids = body.items.map((i) => i.product_id);
    const { rows: products } = await client.query(
      `SELECT p.id, p.name, p.price::float AS price, p.cost::float AS cost,
              p.stock, p.is_service, c.is_ramen
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.id = ANY($1) FOR UPDATE OF p`,
      [ids]
    );
    const productMap = new Map<string, typeof products[number]>(products.map((p) => [p.id, p]));

    const items: { product_id: string; product_name: string; qty: number; unit_price: number; unit_cost: number; is_ramen: boolean; is_service: boolean }[] = [];
    for (const inc of body.items) {
      const p = productMap.get(inc.product_id);
      if (!p) throw new Error(`Producto no existe: ${inc.product_id}`);
      if (!p.is_service && p.stock < inc.qty) {
        throw new Error(`Stock insuficiente para ${p.name} (disponible ${p.stock})`);
      }
      items.push({
        product_id: p.id,
        product_name: p.name,
        qty: inc.qty,
        unit_price: p.price,
        unit_cost: p.cost,
        is_ramen: p.is_ramen,
        is_service: p.is_service,
      });
    }

    const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const totalCost = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
    const ramenQty = items.filter((i) => i.is_ramen).reduce((s, i) => s + i.qty, 0);
    const cheapestRamen = items.filter((i) => i.is_ramen).map((i) => i.unit_price).sort((a, b) => a - b)[0] ?? 0;

    // 2. Loyalty: usar clients (UUID) si viene client_uuid
    let useReward = false;
    let updatedStamps: number | null = null;
    let clientNameSnapshot: string | null = body.client_name ?? null;
    const clientUuid = body.client_uuid || null;

    if (clientUuid) {
      const { rows: cli } = await client.query(
        'SELECT id, name, stamps FROM clients WHERE id = $1 FOR UPDATE',
        [clientUuid]
      );
      if (cli.length === 0) throw new Error('Cliente no encontrado');
      clientNameSnapshot = cli[0].name;
      let stamps = cli[0].stamps as number;

      if (body.use_reward && stamps >= MAX_STAMPS && ramenQty > 0) {
        useReward = true;
        stamps = Math.max(0, stamps - MAX_STAMPS);
      }
      stamps = Math.min(STAMP_HARD_CAP, stamps + ramenQty);

      await client.query(
        `UPDATE clients SET stamps = $1, last_visit_at = now(),
                            total_visits = COALESCE(total_visits, 0) + 1
         WHERE id = $2`,
        [stamps, clientUuid]
      );
      updatedStamps = stamps;
    }

    const discount = useReward ? cheapestRamen : 0;
    const total = subtotal - discount;
    const profit = total - totalCost;

    // 3. Insert sale
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (customer_id, customer_name, client_uuid,
                          subtotal, discount, total, total_cost, profit,
                          payment_method, ramen_qty, reward_used)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, created_at`,
      [
        clientNameSnapshot,
        clientUuid,
        subtotal, discount, total, totalCost, profit,
        body.payment_method, ramenQty, useReward,
      ]
    );
    const saleId = saleRows[0].id;
    const createdAt = saleRows[0].created_at;

    // 4. Items + stock + movements
    for (const i of items) {
      const itemSubtotal = i.unit_price * i.qty;
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity,
                                  unit_price, unit_cost, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [saleId, i.product_id, i.product_name, i.qty, i.unit_price, i.unit_cost, itemSubtotal]
      );
      if (!i.is_service) {
        const cur = await client.query('SELECT stock FROM products WHERE id = $1', [i.product_id]);
        const previous = cur.rows[0].stock;
        const next = Math.max(0, previous - i.qty);
        await client.query(
          'UPDATE products SET stock = $1, updated_at = now() WHERE id = $2',
          [next, i.product_id]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, previous, new_stock, reference)
           VALUES ($1, 'sale', $2, $3, $4, $5)`,
          [i.product_id, -i.qty, previous, next, `Venta #${saleId}`]
        );
      }
    }

    await client.query('COMMIT');

    // 5. Wallet push (fuera de la transacción)
    if (clientUuid && clientNameSnapshot && updatedStamps !== null) {
      const reachedReward = !useReward && updatedStamps >= MAX_STAMPS;
      notifyStampChange(clientUuid, clientNameSnapshot, updatedStamps, {
        alert: useReward
          ? { title: 'Bunsik Rewards', body: '¡Canjeaste tu ramen gratis! 🍜' }
          : reachedReward
          ? { title: 'Bunsik Rewards', body: '¡Completaste tu tarjeta! Tu próximo ramen va por la casa 🍜' }
          : ramenQty > 0
          ? { title: 'Bunsik Rewards', body: `Nuevo sello · ${updatedStamps} / ${MAX_STAMPS} ramens 🍜` }
          : { title: 'Bunsik Rewards', body: `¡Gracias por tu compra!` },
      }).catch((err) => console.error('[Sale] notify error:', err));
    }

    return NextResponse.json({
      success: true,
      sale: {
        id: saleId,
        created_at: createdAt,
        subtotal, discount, total, total_cost: totalCost, profit,
        payment_method: body.payment_method,
        ramen_qty: ramenQty,
        reward_used: useReward,
        client_uuid: clientUuid,
        client_name: clientNameSnapshot,
        client_stamps: updatedStamps,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
          unit_price: i.unit_price,
        })),
      },
    }, { status: 201 });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Sales POST]', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  } finally {
    client.release();
  }
}

// GET /api/admin/sales?range=today|week|month
export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const range = request.nextUrl.searchParams.get('range') || 'today';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);

  let dateFilter = '';
  if (range === 'today') dateFilter = "WHERE s.created_at::date = now()::date";
  else if (range === 'week') dateFilter = "WHERE s.created_at >= now() - INTERVAL '7 days'";
  else if (range === 'month') dateFilter = "WHERE s.created_at >= now() - INTERVAL '30 days'";

  const { rows } = await pool.query(
    `SELECT s.id, s.created_at,
            s.subtotal::float, s.discount::float, s.total::float,
            s.total_cost::float, s.profit::float,
            s.payment_method, s.ramen_qty, s.reward_used,
            s.client_uuid, s.customer_name AS client_name,
            COALESCE(json_agg(json_build_object(
              'product_id', i.product_id,
              'product_name', i.product_name,
              'qty', i.quantity,
              'unit_price', i.unit_price::float
            )) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM sales s
     LEFT JOIN sale_items i ON i.sale_id = s.id
     ${dateFilter}
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return NextResponse.json(rows);
}
