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

// POST /api/admin/broadcast — Enviar push masivo a todos (o a un segmento)
export async function POST(request: NextRequest) {
  await ensureMigrations();

  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { title, body, segment } = await request.json();
    if (!title || !body) {
      return NextResponse.json({ error: 'Título y mensaje requeridos' }, { status: 400 });
    }

    // Filtrar clientes según segmento: 'all' | 'dormant' | 'active'
    let clientFilter = '';
    if (segment === 'dormant') {
      clientFilter = "AND (c.last_visit_at IS NULL OR c.last_visit_at < now() - INTERVAL '30 days')";
    } else if (segment === 'active') {
      clientFilter = "AND c.last_visit_at >= now() - INTERVAL '30 days'";
    }

    const { rows: devices } = await pool.query(
      `SELECT d.id, d.push_token, d.loyalty_card_id
       FROM apple_wallet_devices d
       INNER JOIN clients c ON c.id = d.loyalty_card_id
       WHERE c.business_id = $1 ${clientFilter}`,
      [a.businessId]
    );

    let sent = 0;
    let pruned = 0;

    for (const device of devices) {
      const res = await sendWalletPush(device.push_token, { alert: { title, body } });
      if (res.ok) sent++;
      if (res.status === 410) {
        await pool.query('DELETE FROM apple_wallet_devices WHERE id = $1', [device.id]);
        pruned++;
      }
    }

    // Log
    try {
      await pool.query(
        `INSERT INTO notification_logs (loyalty_card_id, title, message, channel, status)
         SELECT loyalty_card_id, $1, $2, 'apple', 'sent' FROM apple_wallet_devices WHERE push_token = ANY($3)`,
        [title, body, devices.map((d) => d.push_token)]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      totalDevices: devices.length,
      sent,
      pruned,
      segment: segment || 'all',
    });
  } catch (err: any) {
    console.error('[Broadcast] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
