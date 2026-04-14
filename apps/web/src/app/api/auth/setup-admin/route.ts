import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/auth/setup-admin — Crea o resetea un admin.
// Protegido por ADMIN_SETUP_SECRET en ENV (tú lo defines en Railway).
export async function POST(request: NextRequest) {
  try {
    const SETUP_SECRET = process.env.ADMIN_SETUP_SECRET;
    if (!SETUP_SECRET) {
      return NextResponse.json(
        { error: 'ADMIN_SETUP_SECRET no está configurado en el servidor.' },
        { status: 503 }
      );
    }

    const { secret, email, password } = await request.json();

    if (secret !== SETUP_SECRET) {
      return NextResponse.json({ error: 'Secret inválido.' }, { status: 401 });
    }

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Email y password (mín 6 caracteres) son requeridos.' },
        { status: 400 }
      );
    }

    const biz = await pool.query('SELECT id FROM businesses LIMIT 1');
    if (biz.rows.length === 0) {
      return NextResponse.json({ error: 'No existe negocio en DB.' }, { status: 500 });
    }
    const businessId = biz.rows[0].id;

    const password_hash = await bcrypt.hash(password, 10);

    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE admins SET password_hash = $1 WHERE email = $2', [password_hash, email]);
      return NextResponse.json({ success: true, action: 'updated', email });
    }

    await pool.query(
      'INSERT INTO admins (business_id, email, password_hash) VALUES ($1, $2, $3)',
      [businessId, email, password_hash]
    );
    return NextResponse.json({ success: true, action: 'created', email });
  } catch (err: any) {
    console.error('[Setup Admin] Error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
