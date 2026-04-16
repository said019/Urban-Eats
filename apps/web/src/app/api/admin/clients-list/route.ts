import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool, { ensureMigrations } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

export async function GET(request: NextRequest) {
  await ensureMigrations();
  try {
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
    const filter = request.nextUrl.searchParams.get('filter') || 'all';

    let query = `
      SELECT id, name, country_code, phone, stamps, created_at, last_visit_at, birthday,
             CASE
               WHEN last_visit_at IS NULL THEN 'inactive'
               WHEN last_visit_at >= now() - INTERVAL '30 days' THEN 'active'
               ELSE 'dormant'
             END AS status
      FROM clients
      WHERE business_id = $1
    `;
    const params: any[] = [payload.businessId];
    let idx = 2;

    if (filter === 'dormant') {
      query += ` AND (last_visit_at IS NULL OR last_visit_at < now() - INTERVAL '30 days')`;
    } else if (filter === 'active') {
      query += ` AND last_visit_at >= now() - INTERVAL '30 days'`;
    }

    if (search) {
      query += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY COALESCE(last_visit_at, created_at) DESC LIMIT 100`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('[Admin API] List clients error:', err);
    return NextResponse.json({ error: 'Database Error: ' + err.message }, { status: 500 });
  }
}
