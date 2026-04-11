import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:password@localhost:5432/urban_eats'
});

export const dbInit = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión con PostgreSQL exitosa');
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
  }
};
