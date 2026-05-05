import pool, { ensureMigrations } from '@/lib/db';
import { CATALOG } from '@/lib/pos-catalog';

let seedAttempted = false;

/**
 * Inserts the catalog into the products table the first time the database
 * has zero rows. Idempotent — safe to call from any route.
 */
export async function ensureProductsSeeded(): Promise<void> {
  if (seedAttempted) return;
  seedAttempted = true;
  await ensureMigrations();

  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
    if (rows[0].n > 0) return;

    const biz = await pool.query('SELECT id FROM businesses LIMIT 1');
    if (biz.rows.length === 0) return;
    const businessId = biz.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [catKey, cat] of Object.entries(CATALOG)) {
        for (const item of cat.items) {
          await client.query(
            `INSERT INTO products (id, business_id, category_key, category_name, category_color,
                                    name, cost, price, stock, is_ramen, is_service, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
             ON CONFLICT (id) DO NOTHING`,
            [
              item.id,
              businessId,
              catKey,
              cat.name,
              cat.color,
              item.name,
              item.cost,
              item.price,
              item.stock,
              cat.isRamen ?? false,
              item.isService ?? false,
            ]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Seed Products] Error:', err.message);
    seedAttempted = false;
  }
}
