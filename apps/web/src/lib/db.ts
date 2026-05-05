import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:password@localhost:5432/urban_eats',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Idempotent migrations — se corren una vez al primer query.
let migrated = false;
export async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    await pool.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES clients(id);
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday DATE;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_visits INT DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_clients_referred_by ON clients(referred_by);
      CREATE INDEX IF NOT EXISTS idx_clients_birthday ON clients(birthday);
      CREATE INDEX IF NOT EXISTS idx_clients_last_visit ON clients(last_visit_at);

      CREATE TABLE IF NOT EXISTS products (
        id              VARCHAR(64) PRIMARY KEY,
        business_id     UUID REFERENCES businesses(id),
        category_key    VARCHAR(64) NOT NULL,
        category_name   VARCHAR(100) NOT NULL,
        category_color  VARCHAR(20) NOT NULL,
        name            VARCHAR(200) NOT NULL,
        cost            NUMERIC(10,2) NOT NULL,
        price           NUMERIC(10,2) NOT NULL,
        stock           INT NOT NULL DEFAULT 0,
        is_ramen        BOOLEAN DEFAULT false,
        is_service      BOOLEAN DEFAULT false,
        active          BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id     UUID REFERENCES businesses(id),
        client_id       UUID REFERENCES clients(id),
        client_name     VARCHAR(200),
        subtotal        NUMERIC(10,2) NOT NULL,
        discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
        total           NUMERIC(10,2) NOT NULL,
        cost_total      NUMERIC(10,2) NOT NULL,
        profit          NUMERIC(10,2) NOT NULL,
        payment_method  VARCHAR(20) NOT NULL,
        ramen_qty       INT NOT NULL DEFAULT 0,
        reward_used     BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id         UUID REFERENCES sales(id) ON DELETE CASCADE,
        product_id      VARCHAR(64) NOT NULL,
        product_name    VARCHAR(200) NOT NULL,
        qty             INT NOT NULL,
        unit_price      NUMERIC(10,2) NOT NULL,
        unit_cost       NUMERIC(10,2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_key);
      CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    `);
  } catch (err: any) {
    console.error('[DB Migration] Error:', err.message);
    migrated = false;
  }
}

export default pool;
