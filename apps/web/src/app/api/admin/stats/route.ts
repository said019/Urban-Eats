import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool, { ensureMigrations } from '@/lib/db';

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

export async function GET(request: NextRequest) {
  await ensureMigrations();
  const a = auth(request);
  if (!a) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const bid = a.businessId;

  const [totalClients, activeClients, dormantClients, newToday, stampsToday, redemptionsToday, birthdaysToday, weekly] =
    await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM clients WHERE business_id = $1', [bid]),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM clients WHERE business_id = $1 AND last_visit_at >= now() - INTERVAL '30 days'",
        [bid]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM clients WHERE business_id = $1 AND (last_visit_at IS NULL OR last_visit_at < now() - INTERVAL '30 days')",
        [bid]
      ),
      pool.query("SELECT COUNT(*)::int AS n FROM clients WHERE business_id = $1 AND created_at::date = now()::date", [bid]),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM apple_wallet_updates u
         INNER JOIN clients c ON c.id = u.loyalty_card_id
         WHERE c.business_id = $1 AND u.updated_at::date = now()::date`,
        [bid]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM redemptions r
         INNER JOIN clients c ON c.id = r.client_id
         WHERE c.business_id = $1 AND r.unlocked_at::date = now()::date`,
        [bid]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM clients
         WHERE business_id = $1 AND birthday IS NOT NULL
           AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM now())
           AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM now())`,
        [bid]
      ),
      pool.query(
        `SELECT date_trunc('day', u.updated_at)::date AS day, COUNT(*)::int AS stamps
         FROM apple_wallet_updates u
         INNER JOIN clients c ON c.id = u.loyalty_card_id
         WHERE c.business_id = $1 AND u.updated_at >= now() - INTERVAL '7 days'
         GROUP BY day ORDER BY day ASC`,
        [bid]
      ),
    ]);

  return NextResponse.json({
    totalClients: totalClients.rows[0].n,
    activeClients: activeClients.rows[0].n,
    dormantClients: dormantClients.rows[0].n,
    newToday: newToday.rows[0].n,
    stampsToday: stampsToday.rows[0].n,
    redemptionsToday: redemptionsToday.rows[0].n,
    birthdaysToday: birthdaysToday.rows[0].n,
    weekly: weekly.rows,
  });
}
