import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan credenciales.' }, { status: 400 });
    }

    const { rows } = await pool.query(
      'SELECT id, business_id, password_hash FROM admins WHERE email = $1',
      [email]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);

    if (!match) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const token = jwt.sign(
      { adminId: admin.id, businessId: admin.business_id },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return NextResponse.json({ token, success: true });
  } catch (err: any) {
    console.error('[Auth API] Login Error:', err);
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}
