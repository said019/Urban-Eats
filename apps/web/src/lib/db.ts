import { Pool, types } from 'pg';

// Zona horaria del negocio. Todos los cortes de "día" (ventas de hoy, sellos de
// hoy, cumpleaños) se calculan en esta zona; el servidor de Postgres corre en
// UTC, así que sin esto el día cambiaría a las 6 PM hora de México.
const RAW_TZ = process.env.BUSINESS_TZ || 'America/Mexico_City';
export const BUSINESS_TZ = /^[A-Za-z_+\-/]+$/.test(RAW_TZ) ? RAW_TZ : 'America/Mexico_City';

// Fragmentos SQL reutilizables (BUSINESS_TZ está validada arriba, es seguro interpolarla).
// localNowSql: instante actual como timestamp local del negocio (para EXTRACT de mes/día).
export const localNowSql = `(now() AT TIME ZONE '${BUSINESS_TZ}')`;
// localDayStartSql: medianoche local de hoy (+offsetDays) como timestamptz, sargable.
export function localDayStartSql(offsetDays = 0): string {
  const offset = offsetDays === 0 ? '' : ` ${offsetDays >= 0 ? '+' : '-'} INTERVAL '${Math.abs(offsetDays)} days'`;
  return `((date_trunc('day', now() AT TIME ZONE '${BUSINESS_TZ}')${offset}) AT TIME ZONE '${BUSINESS_TZ}')`;
}
// todayFilterSql: predicado "columna cae en el día local de hoy".
export function todayFilterSql(column: string): string {
  return `(${column} >= ${localDayStartSql()} AND ${column} < ${localDayStartSql(1)})`;
}

// Las columnas DATE (p.ej. clients.birthday) se devuelven como string
// 'YYYY-MM-DD' en vez del objeto Date que pg crea a medianoche del proceso
// Node (UTC en producción), que al serializarse corría la fecha un día.
types.setTypeParser(types.builtins.DATE, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:password@localhost:5432/urban_eats',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Respaldo: fija la sesión a la zona del negocio para cualquier query que no
  // use los helpers de arriba (now()::date, CURRENT_DATE, etc.).
  options: `-c TimeZone=${BUSINESS_TZ}`,
});

// Idempotent migrations — se corren una vez al primer query.
let migrated = false;
export async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    // Migrations for the wallet/loyalty side (clients table). The POS schema
    // (products, sales, sale_items, categories, customers, stock_movements)
    // is created by /api/admin/db-init using the user-provided SQL.
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
