import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { buildApplePassBuffer } from '../wallet/apple';

const router = Router();

// Middleware: Autenticación de Apple Wallet (Revisa Header: ApplePass {TOKEN})
const checkAppleAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const expectedToken = `ApplePass ${process.env.APPLE_AUTH_TOKEN || "SECURE_TOKEN_PLACEHOLDER"}`;
  
  // Omitimos la validación estricta para propósitos de prueba local si no hay token en ENV, 
  // pero en producción debe igualar obligatoriamente.
  if (authHeader !== expectedToken) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).send();
    }
  }
  next();
};

// 1. REGISTRAR DISPOSITIVO PARA NOTIFICACIONES PUSH
router.post('/devices/:deviceId/registrations/:passTypeId/:serialNumber', checkAppleAuth, async (req, res) => {
  const { deviceId, passTypeId, serialNumber } = req.params;
  const { pushToken } = req.body;

  if (!pushToken) {
    return res.status(400).send();
  }

  try {
    const existing = await pool.query(
      `SELECT id FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2 AND loyalty_card_id = $3`,
      [deviceId, passTypeId, serialNumber]
    );

    if (existing.rows.length > 0) {
      // Ya existe, actualizar pushToken por si cambió
      await pool.query(
        `UPDATE apple_wallet_devices SET push_token = $1, updated_at = NOW() WHERE id = $2`,
        [pushToken, existing.rows[0].id]
      );
      return res.status(200).send(); // Ya estaba registrado
    } else {
      // Registrar nuevo
      await pool.query(
        `INSERT INTO apple_wallet_devices (device_id, push_token, pass_type_id, loyalty_card_id) VALUES ($1, $2, $3, $4)`,
        [deviceId, pushToken, passTypeId, serialNumber]
      );
      return res.status(201).send(); // Creado
    }
  } catch (err) {
    console.error('[Apple Wallet] DB Error on Register:', err);
    return res.status(500).send();
  }
});

// 2. DAR DE BAJA DISPOSITIVO (BORRÓ LA TARJETA)
router.delete('/devices/:deviceId/registrations/:passTypeId/:serialNumber', checkAppleAuth, async (req, res) => {
  const { deviceId, passTypeId, serialNumber } = req.params;
  try {
    await pool.query(
      `DELETE FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2 AND loyalty_card_id = $3`,
      [deviceId, passTypeId, serialNumber]
    );
    return res.status(200).send();
  } catch (err) {
    return res.status(500).send();
  }
});

// 3. RECUPERAR SERIALES DE PASES ACTUALIZABLES
router.get('/devices/:deviceId/registrations/:passTypeId', async (req, res) => {
  const { deviceId, passTypeId } = req.params;
  const passesUpdatedSince = req.query.passesUpdatedSince as string;

  try {
    // Buscar qué tarjetas tiene este dispositivo
    const queryStr = `
        SELECT awd.loyalty_card_id, awu.updated_at 
        FROM apple_wallet_devices awd
        JOIN apple_wallet_updates awu ON awd.loyalty_card_id = awu.loyalty_card_id
        WHERE awd.device_id = $1 AND awd.pass_type_id = $2
        ${passesUpdatedSince ? 'AND awu.updated_at > $3' : ''}
    `;
    const params = passesUpdatedSince ? [deviceId, passTypeId, new Date(passesUpdatedSince)] : [deviceId, passTypeId];
    
    const { rows } = await pool.query(queryStr, params);

    if (rows.length === 0) {
      return res.status(204).send(); // No hay actualizaciones
    }

    const serialNumbers = rows.map(r => r.loyalty_card_id);
    const maxDate = new Date(Math.max(...rows.map(r => new Date(r.updated_at).getTime()))).toISOString();
    
    return res.json({
      serialNumbers,
      lastUpdated: maxDate
    });

  } catch (err) {
    return res.status(500).send();
  }
});

// 4. DESCARGAR PASE RE-GENERADO DINÁMICAMENTE (CON NUEVOS SELLOS)
router.get('/passes/:passTypeId/:serialNumber', checkAppleAuth, async (req, res) => {
  const { serialNumber } = req.params;

  try {
    // Buscar datos reales del cliente para ese serial
    const { rows } = await pool.query(`SELECT id, name, stamps FROM clients WHERE id = $1`, [serialNumber]);
    if (rows.length === 0) return res.status(404).send();
    
    const client = rows[0];

    // Re-compilar el pase
    const passBuffer = await buildApplePassBuffer(client.id, client.name, client.stamps);
    
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': new Date().toUTCString()
    });
    return res.send(passBuffer);

  } catch (err) {
    console.error('[Apple Wallet] Error generating re-pass:', err);
    return res.status(500).send();
  }
});

// 5. REGISTRAR LOG DE ERRORES DEL DISPOSITIVO
router.post('/log', (req, res) => {
  console.log('[Apple Wallet iOS Client Log]:', req.body);
  res.status(200).send();
});

export default router;
