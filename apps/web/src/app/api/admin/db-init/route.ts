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

const SCHEMA_SQL = `
-- Drop previous experimental tables (mine) so the new schema can be created
DROP VIEW IF EXISTS v_top_customers CASCADE;
DROP VIEW IF EXISTS v_top_products CASCADE;
DROP VIEW IF EXISTS v_today_sales CASCADE;
DROP VIEW IF EXISTS v_inventory_summary CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- 2. ESTRUCTURA DE TABLAS
CREATE TABLE categories (
  id          VARCHAR(50)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7)   NOT NULL,
  is_ramen    BOOLEAN      DEFAULT false,
  sort_order  INT          DEFAULT 0,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE products (
  id           VARCHAR(50)   PRIMARY KEY,
  category_id  VARCHAR(50)   NOT NULL REFERENCES categories(id),
  name         VARCHAR(150)  NOT NULL,
  cost         DECIMAL(10,2) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  stock        INT           NOT NULL DEFAULT 0,
  is_service   BOOLEAN       DEFAULT false,
  is_active    BOOLEAN       DEFAULT true,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active   ON products(is_active);

CREATE TABLE customers (
  id           BIGSERIAL     PRIMARY KEY,
  name         VARCHAR(150)  NOT NULL,
  phone        VARCHAR(20)   NOT NULL UNIQUE,
  stamps       INT           DEFAULT 0,
  rewards      INT           DEFAULT 0,
  total_spent  DECIMAL(10,2) DEFAULT 0,
  visits       INT           DEFAULT 0,
  last_visit   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE sales (
  id            BIGSERIAL     PRIMARY KEY,
  customer_id   BIGINT        REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  client_uuid   UUID          REFERENCES clients(id) ON DELETE SET NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  discount      DECIMAL(10,2) DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL,
  total_cost    DECIMAL(10,2) NOT NULL,
  profit        DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20)  NOT NULL,
  ramen_qty     INT           DEFAULT 0,
  reward_used   BOOLEAN       DEFAULT false,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX idx_sales_customer  ON sales(customer_id);
CREATE INDEX idx_sales_client_uuid ON sales(client_uuid);
CREATE INDEX idx_sales_date      ON sales(created_at);

CREATE TABLE sale_items (
  id           BIGSERIAL     PRIMARY KEY,
  sale_id      BIGINT        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   VARCHAR(50)   NOT NULL REFERENCES products(id),
  product_name VARCHAR(150)  NOT NULL,
  quantity     INT           NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  unit_cost    DECIMAL(10,2) NOT NULL,
  subtotal     DECIMAL(10,2) NOT NULL
);
CREATE INDEX idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

CREATE TABLE stock_movements (
  id           BIGSERIAL    PRIMARY KEY,
  product_id   VARCHAR(50)  NOT NULL REFERENCES products(id),
  type         VARCHAR(20)  NOT NULL,
  quantity     INT          NOT NULL,
  previous     INT          NOT NULL,
  new_stock    INT          NOT NULL,
  reference    VARCHAR(100),
  notes        TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_date    ON stock_movements(created_at);
`;

const CATEGORIES_SQL = `
INSERT INTO categories (id, name, color, is_ramen, sort_order) VALUES
  ('ramen_coreano',  'Ramen Coreano',           '#EC4899', true,  1),
  ('chefsito',       'Ramen Chefsito',          '#F472B6', true,  2),
  ('ramen_mexicano', 'Ramen Mexicano',          '#DB2777', true,  3),
  ('bebidas_meco',   'Bebidas MECO',            '#BE185D', false, 4),
  ('bebidas_okf',    'Bebidas OKF',             '#9D174D', false, 5),
  ('snacks',         'Snacks y Dulces',         '#831843', false, 6),
  ('servicios',      'Servicio de Preparación', '#E11D48', false, 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  is_ramen = EXCLUDED.is_ramen,
  sort_order = EXCLUDED.sort_order;
`;

const PRODUCTS_SQL = `
INSERT INTO products (id, category_id, name, cost, price, stock) VALUES
  ('buldak_carbonara', 'ramen_coreano', 'Buldak Carbonara',         30.00, 45, 160),
  ('buldak_taco',      'ramen_coreano', 'Buldak Taco',              34.00, 50,  20),
  ('tangle_bulgogi',   'ramen_coreano', 'Tangle Bulgogi Alfredo',   30.50, 45,  16),
  ('tangle_mushroom',  'ramen_coreano', 'Tangle Creamy Mushroom',   30.50, 45,  16),
  ('jin_azul',         'ramen_coreano', 'Jin Ramen Azul',           29.50, 40,   7),
  ('volcano',          'ramen_coreano', 'Volcano Ramen',            34.00, 50,   1),
  ('chef_pollo',          'chefsito', 'Pollo Champiñón Verde',     27.50, 40, 3),
  ('chef_pimienta',       'chefsito', 'Pimienta Rattan Turquesa',  27.50, 40, 3),
  ('chef_chiles',         'chefsito', 'Chiles Rojos y Res',        27.50, 40, 3),
  ('chef_col',            'chefsito', 'Col Fermentada Morado',     27.50, 40, 2),
  ('chef_original',       'chefsito', 'Original Rojo',             27.50, 40, 4),
  ('chef_res',            'chefsito', 'Res Picosa Naranja',        27.50, 40, 2),
  ('chef_bowl_mariscos',  'chefsito', 'Bowl Mariscos y Camarón',   38.00, 55, 3),
  ('mep_res',         'ramen_mexicano', 'MEP Carne de Res',                32.00, 45, 8),
  ('mep_pollo',       'ramen_mexicano', 'MEP Pollo',                       32.00, 45, 8),
  ('tapatio_birria',  'ramen_mexicano', 'Tapatío Birria',                  29.50, 42, 9),
  ('tapatio_asada',   'ramen_mexicano', 'Tapatío Carne Asada con Limón',   29.50, 42, 6),
  ('meco_frutos',  'bebidas_meco', 'MECO Frutos Rojos', 42.00, 60, 12),
  ('meco_granada', 'bebidas_meco', 'MECO Granada',      42.00, 60,  5),
  ('meco_limon',   'bebidas_meco', 'MECO Limón',        42.00, 60,  5),
  ('meco_naranja', 'bebidas_meco', 'MECO Naranja',      42.00, 60, 12),
  ('meco_lychee',  'bebidas_meco', 'MECO Lychee',       42.00, 60,  4),
  ('meco_toronja', 'bebidas_meco', 'MECO Toronja',      42.00, 60,  7),
  ('okf_cerezo',     'bebidas_okf', 'OKF Flor de Cerezo',  28.50, 45, 3),
  ('okf_kiwi',       'bebidas_okf', 'OKF Kiwi',            28.50, 45, 6),
  ('okf_mora',       'bebidas_okf', 'OKF Mora Azul',       28.50, 45, 5),
  ('okf_maracuya',   'bebidas_okf', 'OKF Maracuyá',        28.50, 45, 6),
  ('okf_melon',      'bebidas_okf', 'OKF Melón',           28.50, 40, 3),
  ('okf_lim_azul',   'bebidas_okf', 'OKF Limonada Azul',   28.50, 40, 5),
  ('okf_lim_rosa',   'bebidas_okf', 'OKF Limonada Rosa',   28.50, 40, 5),
  ('okf_uva',        'bebidas_okf', 'OKF Uva',             28.50, 40, 4),
  ('okf_fresa',      'bebidas_okf', 'OKF Fresa',           28.50, 40, 1),
  ('okf_sandia',     'bebidas_okf', 'OKF Sandía',          28.50, 40, 1),
  ('okf_gran_color', 'bebidas_okf', 'OKF Granada Color',   28.50, 40, 2),
  ('okf_granada',    'bebidas_okf', 'OKF Granada',         28.50, 40, 6),
  ('amos_durazno',  'snacks', 'Amos Peelerz Durazno',         34.50,  55, 8),
  ('amos_kiwi',     'snacks', 'Amos Peelerz Kiwi',            34.50,  55, 8),
  ('amos_maracuya', 'snacks', 'Amos Peelerz Maracuyá',        34.50,  55, 8),
  ('amos_naranja',  'snacks', 'Amos Peelerz Naranja',         34.50,  55, 8),
  ('amos_manzana',  'snacks', 'Amos Peelerz Manzana Verde',   34.50,  55, 8),
  ('amos_platano',  'snacks', 'Amos Peelerz Plátano',         34.50,  55, 8),
  ('mochi_choco',   'snacks', 'Mochi Chocomenta 180g',        70.50, 115, 6),
  ('mochi_maple',   'snacks', 'Mochi Maple 180g',             70.50, 115, 6),
  ('pretz_cheese',  'snacks', 'Pretz Cheesecake Mora Azul',   55.00,  90, 4),
  ('pretz_matcha',  'snacks', 'Pretz Pastel Matcha',          55.00,  90, 8),
  ('oreo_choc',     'snacks', 'Oreo Chocolate',               52.00,  90, 3),
  ('oreo_matcha',   'snacks', 'Oreo Matcha Chinese',          52.00,  95, 4)
ON CONFLICT (id) DO UPDATE SET
  cost = EXCLUDED.cost, price = EXCLUDED.price, stock = EXCLUDED.stock;

INSERT INTO products (id, category_id, name, cost, price, stock, is_service) VALUES
  ('serv_basico',  'servicios', 'Básico — Agua + Vaso + Palillos',         5.00, 25, 999, true),
  ('serv_clasico', 'servicios', 'Clásico — + Huevo, Cebollín, Nori',      12.00, 45, 999, true),
  ('serv_premium', 'servicios', 'Premium — + Queso, Kimchi, Salchicha',   22.00, 65, 999, true)
ON CONFLICT (id) DO UPDATE SET
  cost = EXCLUDED.cost, price = EXCLUDED.price, is_service = EXCLUDED.is_service;
`;

const MOVEMENTS_SQL = `
INSERT INTO stock_movements (product_id, type, quantity, previous, new_stock, reference, notes) VALUES
  ('buldak_carbonara', 'purchase', 160, 0, 160, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('buldak_taco',      'purchase',  20, 0,  20, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('tangle_bulgogi',   'purchase',  16, 0,  16, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('tangle_mushroom',  'purchase',  16, 0,  16, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('jin_azul',         'purchase',   7, 0,   7, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('volcano',          'purchase',   1, 0,   1, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_pollo',       'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_pimienta',    'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_chiles',      'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_col',         'purchase',   2, 0,   2, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_original',    'purchase',   4, 0,   4, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_res',         'purchase',   2, 0,   2, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('chef_bowl_mariscos','purchase',  3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('mep_res',          'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('mep_pollo',        'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('tapatio_birria',   'purchase',   9, 0,   9, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('tapatio_asada',    'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_frutos',      'purchase',  12, 0,  12, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_granada',     'purchase',   5, 0,   5, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_limon',       'purchase',   5, 0,   5, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_naranja',     'purchase',  12, 0,  12, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_lychee',      'purchase',   4, 0,   4, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('meco_toronja',     'purchase',   7, 0,   7, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_cerezo',       'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_kiwi',         'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_mora',         'purchase',   5, 0,   5, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_maracuya',     'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_melon',        'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_lim_azul',     'purchase',   5, 0,   5, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_lim_rosa',     'purchase',   5, 0,   5, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_uva',          'purchase',   4, 0,   4, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_fresa',        'purchase',   1, 0,   1, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_sandia',       'purchase',   1, 0,   1, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_gran_color',   'purchase',   2, 0,   2, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('okf_granada',      'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_durazno',     'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_kiwi',        'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_maracuya',    'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_naranja',     'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_manzana',     'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('amos_platano',     'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('mochi_choco',      'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('mochi_maple',      'purchase',   6, 0,   6, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('pretz_cheese',     'purchase',   4, 0,   4, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('pretz_matcha',     'purchase',   8, 0,   8, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('oreo_choc',        'purchase',   3, 0,   3, 'Pulpos 7Z8V21U', 'Compra inicial'),
  ('oreo_matcha',      'purchase',   4, 0,   4, 'Pulpos 7Z8V21U', 'Compra inicial');
`;

const VIEWS_SQL = `
CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT
  p.id,
  p.name,
  c.name AS category,
  c.color,
  p.cost,
  p.price,
  p.stock,
  (p.price - p.cost)                               AS unit_margin,
  ROUND(((p.price - p.cost) / p.cost * 100), 0)    AS margin_percent,
  (p.cost  * p.stock)                              AS stock_value_at_cost,
  (p.price * p.stock)                              AS stock_value_at_price,
  CASE
    WHEN p.is_service THEN 'service'
    WHEN p.stock <= 0  THEN 'out'
    WHEN p.stock <= 3  THEN 'critical'
    WHEN p.stock <= 8  THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.is_active = true
ORDER BY c.sort_order, p.name;

CREATE OR REPLACE VIEW v_today_sales AS
SELECT
  COUNT(*)                       AS total_sales,
  COALESCE(SUM(total),     0)    AS revenue,
  COALESCE(SUM(profit),    0)    AS profit,
  COALESCE(SUM(ramen_qty), 0)    AS ramen_sold
FROM sales
-- "Hoy" en hora del negocio (America/Mexico_City), no en el UTC de la sesión.
WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City')
  AND created_at <  ((date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') + INTERVAL '1 day') AT TIME ZONE 'America/Mexico_City');

CREATE OR REPLACE VIEW v_top_products AS
SELECT
  si.product_id,
  si.product_name,
  SUM(si.quantity)  AS units_sold,
  SUM(si.subtotal)  AS revenue,
  SUM(si.subtotal - (si.unit_cost * si.quantity)) AS profit
FROM sale_items si
GROUP BY si.product_id, si.product_name
ORDER BY units_sold DESC;

CREATE OR REPLACE VIEW v_top_customers AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.visits,
  c.stamps,
  c.rewards,
  c.total_spent,
  c.last_visit
FROM customers c
ORDER BY c.total_spent DESC;
`;

// POST /api/admin/db-init — drops conflicting tables and recreates the
// Bunsik schema. Safe to call multiple times.
export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    await client.query(CATEGORIES_SQL);
    await client.query(PRODUCTS_SQL);
    await client.query(MOVEMENTS_SQL);
    await client.query(VIEWS_SQL);
    await client.query('COMMIT');

    const checks = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM stock_movements) AS movements,
        (SELECT COALESCE(SUM(cost*stock),0) FROM products WHERE is_service = false) AS total_invertido
    `);

    return NextResponse.json({ success: true, ...checks.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[DB Init] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
