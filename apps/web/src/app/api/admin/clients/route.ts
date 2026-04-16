import { NextRequest, NextResponse } from 'next/server';
import pool, { ensureMigrations } from '@/lib/db';
import { notifyStampChange } from '@/lib/wallet-notify';

// POST /api/admin/clients — Registro público de clientes
export async function POST(request: NextRequest) {
  await ensureMigrations();

  try {
    const { name, phone, country_code, birthday, referred_by } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono requeridos.' }, { status: 400 });
    }

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

    // Validar referred_by — debe ser un cliente válido
    let validReferrer: string | null = null;
    if (referred_by) {
      const refCheck = await pool.query('SELECT id, name, stamps FROM clients WHERE id::text = $1', [referred_by]);
      if (refCheck.rows.length > 0) {
        validReferrer = refCheck.rows[0].id;
      }
    }

    // Nuevo cliente (con +1 sello si vino por referral)
    const initialStamps = validReferrer ? 1 : 0;
    const newClient = await pool.query(
      `INSERT INTO clients (business_id, name, phone, country_code, stamps, birthday, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [bizRows.rows[0].id, name, phone, code, initialStamps, birthday || null, validReferrer]
    );

    // Bonus al referidor
    if (validReferrer) {
      const updated = await pool.query(
        'UPDATE clients SET stamps = LEAST(stamps + 1, 10) WHERE id = $1 RETURNING name, stamps',
        [validReferrer]
      );
      if (updated.rows.length > 0) {
        const { name: refName, stamps: refStamps } = updated.rows[0];
        notifyStampChange(validReferrer, refName, refStamps, {
          alert: {
            title: 'Urban Eats Rewards',
            body: `¡${name.split(' ')[0]} se unió con tu invitación! +1 sello para ti 🎉`,
          },
        }).catch((err) => console.error('[Register] Referrer notify error:', err));
      }
    }

    return NextResponse.json({
      success: true,
      clientId: newClient.rows[0].id,
      referralBonus: !!validReferrer,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[API] Error registrando cliente:', err);
    return NextResponse.json({ error: 'Error registrando cliente: ' + err.message }, { status: 500 });
  }
}
