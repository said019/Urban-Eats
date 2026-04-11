-- Función y extensión para gen_random_uuid() si es necesario
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  logo_url      TEXT,
  total_stamps  INT DEFAULT 10,
  wallet_config JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES businesses(id),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES businesses(id),
  name          VARCHAR(100) NOT NULL,
  country_code  VARCHAR(10) DEFAULT '+57',
  phone         VARCHAR(20) NOT NULL,
  stamps        INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, country_code, phone)
);

CREATE TABLE rewards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES businesses(id),
  stamp_number  INT NOT NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('discount', 'free_item')),
  value         VARCHAR(100) NOT NULL,
  description   TEXT,
  active        BOOLEAN DEFAULT true
);

CREATE TABLE redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id),
  reward_id     UUID REFERENCES rewards(id),
  unlocked_at   TIMESTAMPTZ DEFAULT now(),
  redeemed_at   TIMESTAMPTZ,
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed'))
);

CREATE TABLE wallet_passes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id),
  serial_number   VARCHAR(100) UNIQUE NOT NULL,
  platform        VARCHAR(10) CHECK (platform IN ('apple', 'google')),
  pass_data       JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_clients_phone ON clients(country_code, phone);
CREATE INDEX idx_clients_business ON clients(business_id);
CREATE INDEX idx_redemptions_client ON redemptions(client_id);

-- Wallet Integration Tables

CREATE TABLE apple_wallet_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       VARCHAR(255) NOT NULL,
  push_token      VARCHAR(255) NOT NULL,
  pass_type_id    VARCHAR(255) NOT NULL,
  loyalty_card_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, pass_type_id, loyalty_card_id)
);

CREATE TABLE apple_wallet_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_card_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  stamps_old      INT,
  stamps_new      INT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_card_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title           VARCHAR(255),
  message         TEXT NOT NULL,
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('apple', 'google')),
  status          VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notification_logs_card ON notification_logs(loyalty_card_id, created_at);

-- Seed Inicial
-- Como necesitamos los IDs para referencias, usamos una inserción genérica para pruebas.
DO $$ 
DECLARE 
    biz_id UUID;
BEGIN
    INSERT INTO businesses (name) VALUES ('Urban Eats') RETURNING id INTO biz_id;
    
    INSERT INTO rewards (business_id, stamp_number, type, value, description) VALUES
      (biz_id, 5, 'discount', '25', '25% de descuento en tu siguiente compra'),
      (biz_id, 10, 'free_item', 'Mini Perro', 'Mini perro gratis por completar tu tarjeta');

    -- Admin dev account: admin@urbaneats.com / password123 (hash generado para bcrypt)
    -- bcrypt('$2b$10$XmO...' para 'password123') -> usaremos uno genérico generado
    INSERT INTO admins (business_id, email, password_hash) VALUES
      (biz_id, 'admin@urbaneats.com', '$2b$10$Ew.Y9D3wE6E8pX.B0J5qZeN/rN.mIt5j1Fj1X9L1P6g5/0X4m0xIu');

    -- Cliente de Prueba "Sarah J!"
    INSERT INTO clients (business_id, name, phone, stamps) VALUES
      (biz_id, 'Sarah J!', '1234567890', 5);

END $$;
