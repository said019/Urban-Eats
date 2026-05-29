import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool, { ensureMigrations } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

export const dynamic = 'force-dynamic';

// Devuelve { businessId } del JWT. Mismo patrón que /api/admin/stats.
function auth(req: NextRequest): { businessId: string } | null {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { businessId: string };
    return { businessId: payload.businessId };
  } catch {
    return null;
  }
}

type Range = 'today' | 'week' | 'month';

// Allowlist explícita: el valor de ?range nunca se interpola crudo en SQL.
function dateFilterFor(range: Range): string {
  if (range === 'week') return "WHERE s.created_at >= now() - INTERVAL '7 days'";
  if (range === 'month') return "WHERE s.created_at >= now() - INTERVAL '30 days'";
  return "WHERE s.created_at::date = now()::date"; // today
}

// GET /api/admin/reports?range=today|week|month
//
// Endpoint agregado para la pantalla de Reportes. En una sola respuesta:
//   - totals:       ingresos/margen/ventas/ramens del periodo (revenue NETO de descuentos).
//   - byPayment:    desglose por método de pago (Efectivo/Tarjeta/Transferencia).
//   - topProducts:  productos más vendidos del periodo, liderado por unidades.
//   - sales:        historial detallado de ventas (misma forma que /api/admin/sales GET).
//
// NOTA (multi-tenant): la tabla `sales` no tiene columna business_id. El único
// vínculo a un negocio es client_uuid -> clients.business_id, que es NULL en
// toda venta de mostrador. Filtrar por negocio haría caer las ventas anónimas y
// subreportaría los ingresos, así que NO filtramos aquí. La app es de un solo
// negocio hoy, y /api/admin/sales (GET y POST) tampoco filtran, por lo que esto
// es consistente. auth() ya extrae businessId; cuando exista sales.business_id
// (migración futura) basta con sumar `AND s.business_id = $1` a cada query.
export async function GET(request: NextRequest) {
  await ensureMigrations();

  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rawRange = request.nextUrl.searchParams.get('range');
  const range: Range = rawRange === 'week' || rawRange === 'month' ? rawRange : 'today';
  const dateFilter = dateFilterFor(range);

  try {
    const [totals, byPayment, topProducts, sales] = await Promise.all([
      // Totales del periodo. revenue/profit son NETOS (los descuentos de
      // recompensa ya están restados en sales.total y sales.profit).
      pool.query(
        `SELECT COUNT(*)::int                       AS sales,
                COALESCE(SUM(s.total), 0)::float     AS revenue,
                COALESCE(SUM(s.profit), 0)::float    AS profit,
                COALESCE(SUM(s.ramen_qty), 0)::int   AS ramen,
                COALESCE(SUM(s.total_cost), 0)::float AS cost
         FROM sales s
         ${dateFilter}`
      ),

      // Desglose por método de pago. payment_method es texto libre escrito por
      // el POS (Efectivo/Tarjeta/Transferencia); se devuelve verbatim.
      pool.query(
        `SELECT s.payment_method                 AS method,
                COUNT(*)::int                     AS count,
                COALESCE(SUM(s.total), 0)::float  AS revenue
         FROM sales s
         ${dateFilter}
         GROUP BY s.payment_method
         ORDER BY revenue DESC`
      ),

      // Top productos del periodo. Se une sale_items con sales para aplicar el
      // filtro de fecha (la vista v_top_products no tiene filtro temporal).
      //
      // OJO: el descuento de recompensa vive a nivel venta (sales.discount), no
      // en los items, así que este `revenue` es BRUTO (antes del descuento) y
      // puede ser >= totals.revenue en días con canje. Por eso la UI lidera con
      // `units` (exacto) y trata revenue como secundario. El ingreso autoritativo
      // del periodo es siempre totals.revenue.
      pool.query(
        `SELECT i.product_id,
                i.product_name,
                SUM(i.quantity)::int                                          AS units,
                COALESCE(SUM(i.subtotal), 0)::float                           AS revenue,
                COALESCE(SUM(i.subtotal - i.unit_cost * i.quantity), 0)::float AS profit
         FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
         ${dateFilter}
         GROUP BY i.product_id, i.product_name
         ORDER BY units DESC
         LIMIT 10`
      ),

      // Historial detallado: misma forma que /api/admin/sales GET (con items).
      pool.query(
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
         LIMIT 200`
      ),
    ]);

    return NextResponse.json({
      range,
      totals: totals.rows[0],
      byPayment: byPayment.rows,
      topProducts: topProducts.rows,
      sales: sales.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    console.error('[Reports API] Error:', err);
    return NextResponse.json({ error: 'Database Error: ' + message }, { status: 500 });
  }
}
