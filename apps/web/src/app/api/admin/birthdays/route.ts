import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool, { ensureMigrations } from '@/lib/db';
import { sendWalletPush } from '@/lib/apple-wallet';

const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

function auth(req: NextRequest): { businessId: string } | null {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    return { businessId: payload.businessId };
  } catch {
    return null;
  }
}

// GET /api/admin/birthdays?when=today|week|month
// Lista clientes con cumpleaños en el rango elegido.
export async function GET(request: NextRequest) {
  await ensureMigrations();
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const when = request.nextUrl.searchParams.get('when') || 'today';
  let dateFilter = '';
  if (when === 'today') {
    dateFilter = "AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM now()) AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM now())";
  } else if (when === 'week') {
    dateFilter = `AND (
      (EXTRACT(MONTH FROM birthday) * 100 + EXTRACT(DAY FROM birthday))
      BETWEEN
      (EXTRACT(MONTH FROM now()) * 100 + EXTRACT(DAY FROM now()))
      AND
      (EXTRACT(MONTH FROM now() + INTERVAL '7 days') * 100 + EXTRACT(DAY FROM now() + INTERVAL '7 days'))
    )`;
  } else if (when === 'month') {
    dateFilter = "AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM now())";
  }

  const { rows } = await pool.query(
    `SELECT id, name, country_code, phone, birthday, stamps
     FROM clients
     WHERE business_id = $1 AND birthday IS NOT NULL ${dateFilter}
     ORDER BY EXTRACT(MONTH FROM birthday), EXTRACT(DAY FROM birthday)`,
    [a.businessId]
  );

  return NextResponse.json(rows);
}

// POST /api/admin/birthdays — Envía push de cumpleaños a TODOS los que cumplen hoy
export async function POST(request: NextRequest) {
  await ensureMigrations();
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT d.id, d.push_token, c.name
     FROM apple_wallet_devices d
     INNER JOIN clients c ON c.id = d.loyalty_card_id
     WHERE c.business_id = $1
       AND c.birthday IS NOT NULL
       AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM now())
       AND EXTRACT(DAY FROM c.birthday) = EXTRACT(DAY FROM now())`,
    [a.businessId]
  );

  let sent = 0;
  for (const device of rows) {
    const firstName = (device.name || '').split(' ')[0];
    const res = await sendWalletPush(device.push_token, {
      alert: {
        title: '¡Feliz cumpleaños! 🎂',
        body: `${firstName}, tienes un Perro GRATIS de regalo. Ven hoy a Urban Eats. 🌭`,
      },
    });
    if (res.ok) sent++;
    if (res.status === 410) {
      await pool.query('DELETE FROM apple_wallet_devices WHERE id = $1', [device.id]);
    }
  }

  return NextResponse.json({ success: true, sent, totalDevices: rows.length });
}
