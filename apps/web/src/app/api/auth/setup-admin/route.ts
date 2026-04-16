import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// POST /api/auth/setup-admin — Crea o resetea un admin.
// Auth: ADMIN_SETUP_SECRET, valid admin JWT, or bootstrap mode.
export async function POST(request: NextRequest) {
  try {
    const SETUP_SECRET = process.env.ADMIN_SETUP_SECRET;
    const { secret, email, password } = await request.json();

    // Bootstrap mode: permitir sin secret si solo existe el admin semilla (o ninguno)
    const SEED_HASH = '$2b$10$Ew.Y9D3wE6E8pX.B0J5qZeN/rN.mIt5j1Fj1X9L1P6g5/0X4m0xIu';
    const countReal = await pool.query('SELECT COUNT(*)::int AS n FROM admins WHERE password_hash != $1', [SEED_HASH]);
    const isBootstrap = countReal.rows[0].n === 0;

    // Check auth: bootstrap OR SETUP_SECRET OR valid admin JWT
    let authorized = isBootstrap;

    if (!authorized && SETUP_SECRET && secret === SETUP_SECRET) {
      authorized = true;
    }

    if (!authorized) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        try {
          jwt.verify(token, JWT_SECRET);
          authorized = true;
        } catch {}
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
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
