import { Router, Request, Response, RequestHandler } from 'express';
import { pool } from '../db';
import { sendAPNsAlertNotification, buildApplePassBuffer } from '../wallet/apple';

const router = Router();

// GET /api/loyalty/clients/:clientId/apple-wallet
export const getAppleWalletPass: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { clientId } = req.params;
  try {
    const { rows } = await pool.query('SELECT id, name, stamps FROM clients WHERE id = $1', [clientId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    
    const client = rows[0];
    const passBuffer = await buildApplePassBuffer(client.id, client.name, client.stamps);
    
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${client.name}_Urban_Eats.pkpass"`
    });
    
    res.send(passBuffer);
  } catch (error) {
    console.error('[Download Pass] Error:', error);
    res.status(500).json({ error: 'Error interno generando el Pase de Apple.' });
  }
};

// GET /api/loyalty/clients/by-name/:name (Para facilitar el test local basado en "/card/sarah")
export const getClientByName: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const name = req.params.name;
  try {
    const { rows } = await pool.query(`SELECT id, name, stamps FROM clients WHERE name ILIKE $1 LIMIT 1`, [`%${name}%`]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    const client = rows[0];
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /api/loyalty/clients/:clientId
export const getClientDetails: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { clientId } = req.params;
  try {
    const { rows } = await pool.query('SELECT id, name, stamps FROM clients WHERE id = $1', [clientId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    const client = rows[0];
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno de base de datos' });
  }
};

// POST /api/loyalty/clients/:clientId/redeem
export const redeemReward: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { clientId } = req.params;
  const { type } = req.body; // 'discount' | 'free'

  try {
    await pool.query('BEGIN');

    const clientRes = await pool.query('SELECT stamps, name FROM clients WHERE id = $1 FOR UPDATE', [clientId]);
    if (clientRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }

    const { stamps, name } = clientRes.rows[0];

    // Validar si tiene suficientes sellos
    if (type === 'discount' && stamps < 5) {
      await pool.query('ROLLBACK');
      res.status(400).json({ error: 'No tienes suficientes sellos (requerido: 5)' });
      return;
    }
    if (type === 'free' && stamps < 10) {
      await pool.query('ROLLBACK');
      res.status(400).json({ error: 'No tienes suficientes sellos (requerido: 10)' });
      return;
    }

    // Calcular nuevos sellos
    let newStamps = stamps;
    if (type === 'discount') {
      newStamps = stamps; // El descuento en sello 5 no quita sellos, es un milestone pasivo.
      // Ojo: Si quita sellos, cambiamos a `stamps - 5`. Pero por UX el milestone de 5 se guarda hasta llegar a 10 normalmente.
      // Para este MVP vamos a "consumirlo", reiniciando a 0 para simplificar o dejarlo pasar.
      // Según la UX que hicimos, al darle Tap a 5 y redimir, reinicia la tarjeta si es 10, si es 5 no reinicia, pero ya se usó.
      // Necesitamos logear esto en `redemptions`.
    } else if (type === 'free') {
      newStamps = 0; // Reinicia la tarjeta
      await pool.query('UPDATE clients SET stamps = 0 WHERE id = $1', [clientId]);
    }

    // Registrar canje
    await pool.query(`
      INSERT INTO redemptions (client_id, status)
      VALUES ($1, 'redeemed')
    `, [clientId]);

    await pool.query('COMMIT');

    // Aquí iría el updatePush si fuera necesario
    // sendAPNsAlertNotification(...);

    res.json({ success: true, newStamps, message: `Recompensa ${type} canjeada exitosamente por ${name}!` });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Fallo procesando el canje' });
  }
};

router.get('/clients/search/:name', getClientByName);
router.get('/clients/:clientId', getClientDetails);
router.get('/clients/:clientId/apple-wallet', getAppleWalletPass);
router.post('/clients/:clientId/redeem', redeemReward);

export default router;
