import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST /api/admin/clients — Registro público de clientes
export async function POST(request: NextRequest) {
  try {
    const { name, phone, country_code } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono requeridos.' }, { status: 400 });
    }

    // Tomar el único negocio
    const bizRows = await pool.query('SELECT id FROM businesses LIMIT 1');
    if (bizRows.rows.length === 0) {
      return NextResponse.json({ error: 'No existe negocio en DB.' }, { status: 500 });
    }

    const code = country_code || '+52';

    // Check duplicados
    const check = await pool.query(
      'SELECT id FROM clients WHERE phone = $1 AND country_code = $2',
      [phone, code]
    );
    if (check.rows.length > 0) {
      return NextResponse.json(
        { error: 'Este número ya está registrado.', clientId: check.rows[0].id },
        { status: 409 }
      );
    }

    const newClient = await pool.query(
      'INSERT INTO clients (business_id, name, phone, country_code, stamps) VALUES ($1, $2, $3, $4, 0) RETURNING id',
      [bizRows.rows[0].id, name, phone, code]
    );

    return NextResponse.json({ success: true, clientId: newClient.rows[0].id }, { status: 201 });
  } catch (err: any) {
    console.error('[API] Error registrando cliente:', err);
    return NextResponse.json({ error: 'Error registrando cliente: ' + err.message }, { status: 500 });
  }
}
