import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'URBAN_EATS_DEFAULT_SUPER_SECRET';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan credenciales.' });
  }

  try {
    const { rows } = await pool.query('SELECT id, business_id, password_hash FROM admins WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { adminId: admin.id, businessId: admin.business_id },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, success: true });
  } catch (error) {
    console.error('[Auth API] Login Error:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
