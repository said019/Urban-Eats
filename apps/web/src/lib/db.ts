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
    `);
  } catch (err: any) {
    console.error('[DB Migration] Error:', err.message);
    migrated = false;
  }
}

export default pool;
