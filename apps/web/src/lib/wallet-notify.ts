import pool from '@/lib/db';
import { sendWalletPush } from '@/lib/apple-wallet';
import { updateGoogleWalletStamps } from '@/lib/google-wallet';

/**
 * Notifica a todos los wallets (Apple + Google) cuando los sellos del cliente cambian.
 * - Apple: registra timestamp en apple_wallet_updates + envía push silencioso a cada dispositivo,
 *   opcionalmente seguido de una alerta visible.
 * - Google: hace PATCH del loyalty object para reflejar el nuevo balance.
 */
export async function notifyStampChange(
  clientId: string,
  clientName: string,
  newStamps: number,
  opts: { alert?: { title: string; body: string } } = {}
): Promise<void> {
  // 1. Registrar update en DB
  try {
    await pool.query(
      'INSERT INTO apple_wallet_updates (loyalty_card_id, stamps_new) VALUES ($1, $2)',
      [clientId, newStamps]
    );
  } catch (err: any) {
    console.error('[Notify] Error logging update:', err.message);
  }

  // 2. Enviar push silencioso a cada dispositivo Apple
  try {
    const { rows: devices } = await pool.query(
      'SELECT id, push_token FROM apple_wallet_devices WHERE loyalty_card_id = $1',
      [clientId]
    );

    for (const device of devices) {
      const silent = await sendWalletPush(device.push_token);
      if (silent.status === 410) {
        // Token inválido → eliminar dispositivo
        await pool.query('DELETE FROM apple_wallet_devices WHERE id = $1', [device.id]);
        continue;
      }
      if (opts.alert) {
        await sendWalletPush(device.push_token, { alert: opts.alert });
      }
    }
  } catch (err: any) {
    console.error('[Notify] Apple push error:', err.message);
  }

  // 3. Actualizar Google Wallet
  await updateGoogleWalletStamps(clientId, clientName, newStamps);
}
