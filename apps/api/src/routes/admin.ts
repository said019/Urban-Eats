import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { buildApplePassBuffer, sendAPNsAlertNotification } from '../wallet/apple';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// Middleware Protector
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta Token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).adminId = payload.adminId;
    (req as any).businessId = payload.businessId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token Inválido' });
  }
};

// GET /api/admin/clients -> Lista los clientes del negocio
router.get('/clients', requireAdmin, async (req: Request, res: Response) => {
  const bizId = (req as any).businessId;
  const search = req.query.search as string;

  try {
    let query = `
      SELECT id, name, country_code, phone, stamps, created_at 
      FROM clients 
      WHERE business_id = $1
    `;
    const params: any[] = [bizId];

    if (search) {
      query += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database Error' });
  }
});

// POST /api/admin/clients/:id/stamp -> Añadir 1 Sello manualmente
router.post('/clients/:id/stamp', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const clientQuery = await pool.query('SELECT stamps FROM clients WHERE id = $1', [id]);
  
  if (clientQuery.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  
  let currentStamps = clientQuery.rows[0].stamps;
  if (currentStamps >= 10) return res.status(400).json({ error: 'El cliente ya tiene los 10 sellos.' });

  try {
    const { rows } = await pool.query(
      'UPDATE clients SET stamps = stamps + 1 WHERE id = $1 RETURNING stamps',
      [id]
    );
    const updatedStamps = rows[0].stamps;

    // Disparar Web Service de Apple para todos los dispositivos del cliente
    try {
      const devices = await pool.query(`SELECT push_token FROM apple_wallet_devices WHERE loyalty_card_id = $1`, [id]);
      for (const dev of devices.rows) {
        // Enviar empuje APNs background
        await sendAPNsAlertNotification(dev.push_token, 'background');
      }
      // Insertar en tabla de log de actualizaciones para el GET de iOS
      await pool.query(
        `INSERT INTO apple_wallet_updates (loyalty_card_id, stamps_old, stamps_new) VALUES ($1, $2, $3)`,
        [id, currentStamps, updatedStamps]
      );
    } catch (pushErr) {
      console.error('[Admin API] Error notificando a Apple Wallet devices:', pushErr);
    }

    res.json({ success: true, newStamps: updatedStamps });
  } catch (err) {
    res.status(500).json({ error: 'Error agregando sello.' });
  }
});

// POST /api/admin/clients -> Registrar cliente público (puede venir abierto desde el registro del celular, así que no usa requireAdmin)
router.post('/clients', async (req: Request, res: Response) => {
  const { name, phone, country_code } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Nombre y teléfono requeridos.' });

  try {
    // Tomar el único negocio por default
    const bizRows = await pool.query('SELECT id FROM businesses LIMIT 1');
    if(bizRows.rows.length === 0) return res.status(500).json({ error: 'No existe negocio en DB.' });
    
    // Constraint check manual por dupes
    const check = await pool.query('SELECT id FROM clients WHERE phone = $1 AND country_code = $2', [phone, country_code || '+57']);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Este número ya está registrado.', clientId: check.rows[0].id });
    }

    const newClient = await pool.query(
      'INSERT INTO clients (business_id, name, phone, country_code, stamps) VALUES ($1, $2, $3, $4, 0) RETURNING id',
      [bizRows.rows[0].id, name, phone, country_code || '+57']
    );
    return res.status(201).json({ success: true, clientId: newClient.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Error registrando cliente' });
  }
});

export default router;
