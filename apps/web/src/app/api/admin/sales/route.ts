import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';
const MAX_STAMPS = 6;
const STAMP_HARD_CAP = 12;

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

type IncomingItem = { product_id: string; qty: number };
type IncomingSale = {
  client_id?: string | null;
  client_name?: string | null;
  payment_method: string;
  items: IncomingItem[];
  use_reward?: boolean;
};

// POST /api/admin/sales — Registra venta atómica:
// - Verifica stock
// - Crea sale + sale_items
// - Decrementa stock
// - Suma sellos al cliente (1 por cada ramen) o canjea recompensa si use_reward=true
// - Devuelve sale completa con totales
export async function POST(request: NextRequest) {
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

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

    // Lock products and load current data
    const ids = body.items.map((i) => i.product_id);
    const { rows: products } = await client.query(
      `SELECT id, name, price::float AS price, cost::float AS cost, stock, is_ramen, is_service
       FROM products
       WHERE business_id = $1 AND id = ANY($2)
       FOR UPDATE`,
      [a.businessId, ids]
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
    const costTotal = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
    const ramenQty = items.filter((i) => i.is_ramen).reduce((s, i) => s + i.qty, 0);
    const cheapestRamen = items.filter((i) => i.is_ramen).map((i) => i.unit_price).sort((a, b) => a - b)[0] ?? 0;

    // Stamp / reward handling
    let useReward = false;
    let updatedClientStamps: number | null = null;
    let updatedClientName: string | null = null;
    let clientId: string | null = body.client_id || null;

    if (clientId) {
      const { rows: cli } = await client.query(
        'SELECT id, name, stamps FROM clients WHERE id = $1 AND business_id = $2 FOR UPDATE',
        [clientId, a.businessId]
      );
      if (cli.length === 0) throw new Error('Cliente no encontrado');
      updatedClientName = cli[0].name;
      let stamps = cli[0].stamps as number;

      if (body.use_reward && stamps >= MAX_STAMPS && ramenQty > 0) {
        useReward = true;
        stamps = Math.max(0, stamps - MAX_STAMPS);
      }
      // Add stamps
      stamps = Math.min(STAMP_HARD_CAP, stamps + ramenQty);

      await client.query(
        `UPDATE clients
         SET stamps = $1,
             last_visit_at = now(),
             total_visits = COALESCE(total_visits, 0) + 1
         WHERE id = $2`,
        [stamps, clientId]
      );
      updatedClientStamps = stamps;
    }

    const discount = useReward ? cheapestRamen : 0;
    const total = subtotal - discount;
    const profit = total - costTotal;

    // Insert sale
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (business_id, client_id, client_name, subtotal, discount, total,
                          cost_total, profit, payment_method, ramen_qty, reward_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, created_at`,
      [
        a.businessId,
        clientId,
        body.client_name ?? updatedClientName ?? null,
        subtotal, discount, total, costTotal, profit,
        body.payment_method, ramenQty, useReward,
      ]
    );
    const saleId = saleRows[0].id;
    const createdAt = saleRows[0].created_at;

    // Insert items + decrement stock
    for (const i of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, i.product_id, i.product_name, i.qty, i.unit_price, i.unit_cost]
      );
      if (!i.is_service) {
        await client.query(
          'UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = now() WHERE id = $2 AND business_id = $3',
          [i.qty, i.product_id, a.businessId]
        );
      }
    }

    await client.query('COMMIT');

    // Trigger wallet push outside the transaction
    if (clientId && updatedClientName !== null && updatedClientStamps !== null) {
      const reachedReward = !useReward && updatedClientStamps >= MAX_STAMPS;
      notifyStampChange(clientId, updatedClientName, updatedClientStamps, {
        alert: useReward
          ? { title: 'Bunsik Rewards', body: '¡Canjeaste tu ramen gratis! 🍜' }
          : reachedReward
          ? { title: 'Bunsik Rewards', body: '¡Completaste tu tarjeta! Tu próximo ramen va por la casa 🍜' }
          : ramenQty > 0
          ? { title: 'Bunsik Rewards', body: `Nuevo sello · ${updatedClientStamps} / ${MAX_STAMPS} ramens 🍜` }
          : { title: 'Bunsik Rewards', body: `¡Gracias por tu compra! Sigues con ${updatedClientStamps} / ${MAX_STAMPS} sellos.` },
      }).catch((err) => console.error('[Sale] notify error:', err));
    }

    return NextResponse.json({
      success: true,
      sale: {
        id: saleId,
        created_at: createdAt,
        subtotal, discount, total, cost_total: costTotal, profit,
        payment_method: body.payment_method,
        ramen_qty: ramenQty,
        reward_used: useReward,
        client_id: clientId,
        client_name: updatedClientName,
        client_stamps: updatedClientStamps,
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
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const range = request.nextUrl.searchParams.get('range') || 'today';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);

  let dateFilter = '';
  if (range === 'today') dateFilter = "AND s.created_at::date = now()::date";
  else if (range === 'week') dateFilter = "AND s.created_at >= now() - INTERVAL '7 days'";
  else if (range === 'month') dateFilter = "AND s.created_at >= now() - INTERVAL '30 days'";

  const { rows } = await pool.query(
    `SELECT s.id, s.created_at,
            s.subtotal::float, s.discount::float, s.total::float,
            s.cost_total::float, s.profit::float,
            s.payment_method, s.ramen_qty, s.reward_used,
            s.client_id, s.client_name,
            COALESCE(json_agg(json_build_object(
              'product_id', i.product_id,
              'product_name', i.product_name,
              'qty', i.qty,
              'unit_price', i.unit_price::float
            )) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM sales s
     LEFT JOIN sale_items i ON i.sale_id = s.id
     WHERE s.business_id = $1 ${dateFilter}
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [a.businessId, limit]
  );

  return NextResponse.json(rows);
}
