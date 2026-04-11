import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import loyaltyRouter from './routes/loyalty';
import walletServiceRouter from './routes/apple-wallet-service';
import { dbInit } from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Cambiado a 3001 por si 3000 es web

app.use(cors());
app.use(express.json());

// Servir assets de wallet (logo, strips) para Google Wallet
app.use('/api/loyalty/assets', express.static(path.join(process.cwd(), 'wallet-assets', 'apple.pass')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import authRouter from './routes/auth';
import adminRouter from './routes/admin';

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/wallet/v1', walletServiceRouter);

dbInit().then(() => {
  app.listen(port, () => {
    console.log(`🚀 API running on port ${port}`);
  });
});
