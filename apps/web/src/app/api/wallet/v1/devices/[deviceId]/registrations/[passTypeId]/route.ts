import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/wallet/v1/devices/:deviceId/registrations/:passTypeId?passesUpdatedSince=<tag>
// Devuelve lista de serials actualizados desde el `passesUpdatedSince` tag.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string }> }
) {
  try {
    const { deviceId, passTypeId } = await params;
    const sinceStr = request.nextUrl.searchParams.get('passesUpdatedSince');
    const since = sinceStr ? parseInt(sinceStr, 10) : 0;

    // Obtener dispositivos registrados
    const registrations = await pool.query(
      'SELECT loyalty_card_id FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2',
      [deviceId, passTypeId]
    );

    if (registrations.rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const cardIds = registrations.rows.map((r) => r.loyalty_card_id);

    // Filtrar por últimas actualizaciones
    const updatesQuery = await pool.query(
      `SELECT loyalty_card_id, EXTRACT(EPOCH FROM MAX(updated_at))::bigint AS last_ts
       FROM apple_wallet_updates
       WHERE loyalty_card_id = ANY($1)
         AND EXTRACT(EPOCH FROM updated_at) > $2
       GROUP BY loyalty_card_id`,
      [cardIds, since]
    );

    if (updatesQuery.rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const serialNumbers = updatesQuery.rows.map((r) => r.loyalty_card_id);
    const lastUpdated = String(Math.max(...updatesQuery.rows.map((r) => Number(r.last_ts))));

    return NextResponse.json({ serialNumbers, lastUpdated });
  } catch (err: any) {
    console.error('[Wallet] Get registrations error:', err);
    return new NextResponse('Server Error', { status: 500 });
  }
}
