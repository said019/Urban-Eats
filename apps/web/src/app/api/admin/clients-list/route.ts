import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// GET /api/admin/clients-list — Lista clientes (protegido por JWT)
export async function GET(request: NextRequest) {
  try {
    // Verificar JWT
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Falta Token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Token Inválido' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search') || '';

    let query = `
      SELECT id, name, country_code, phone, stamps, created_at 
      FROM clients 
      WHERE business_id = $1
    `;
    const params: any[] = [payload.businessId];

    if (search) {
      query += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('[Admin API] List clients error:', err);
    return NextResponse.json({ error: 'Database Error: ' + err.message }, { status: 500 });
  }
}
