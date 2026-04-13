import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/loyalty/clients/[clientId] — Obtener datos del cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Intentar buscar primero por UUID (id directo)
    let query = 'SELECT id, name, country_code, phone, stamps, created_at FROM clients WHERE id::text = $1';
    let { rows } = await pool.query(query, [clientId]);

    // Fallback: buscar por "slug" basado en nombre (ej: "sarah" -> "Sarah J!")
    if (rows.length === 0) {
      const { rows: slugRows } = await pool.query(
        'SELECT id, name, country_code, phone, stamps, created_at FROM clients WHERE LOWER(name) LIKE $1 LIMIT 1',
        [`%${clientId.toLowerCase()}%`]
      );
      rows = slugRows;
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('[Loyalty API] Client fetch error:', err);
    return NextResponse.json({ error: 'Error: ' + err.message }, { status: 500 });
  }
}
