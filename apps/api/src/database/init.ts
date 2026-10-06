import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool } from './index.js';

let initialization: Promise<void> | null = null;

export function initializeDatabase() {
  if (!initialization) initialization = initialize();
  return initialization;
}

async function initialize() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN','OPERATOR')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS equipments (
      id SERIAL PRIMARY KEY,
      internal_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      model TEXT,
      brand TEXT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      serial_number TEXT UNIQUE,
      tracking_mode TEXT NOT NULL DEFAULT 'UNIT' CHECK (tracking_mode IN ('UNIT','BATCH')),
      total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity > 0),
      condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (condition IN ('NEW','GOOD','REGULAR','MAINTENANCE','WRITTEN_OFF')),
      acquisition_date TIMESTAMPTZ,
      acquisition_value REAL,
      photo_path TEXT,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS movements (
      id SERIAL PRIMARY KEY,
      movement_code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('EXTERNAL','RENTAL')),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIALLY_RETURNED','RETURNED','OVERDUE','CANCELLED')),
      responsible_name TEXT NOT NULL,
      responsible_user_id INTEGER REFERENCES users(id),
      destination TEXT NOT NULL,
      project_client TEXT,
      checkout_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expected_return_at TIMESTAMPTZ NOT NULL,
      renter_name TEXT,
      renter_document TEXT,
      renter_phone TEXT,
      rental_value REAL,
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS movement_items (
      id SERIAL PRIMARY KEY,
      movement_id INTEGER NOT NULL REFERENCES movements(id),
      equipment_id INTEGER NOT NULL REFERENCES equipments(id),
      quantity_out INTEGER NOT NULL CHECK (quantity_out > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS returns (
      id SERIAL PRIMARY KEY,
      movement_id INTEGER NOT NULL REFERENCES movements(id),
      returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      received_by INTEGER NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS return_items (
      id SERIAL PRIMARY KEY,
      return_id INTEGER NOT NULL REFERENCES returns(id),
      movement_item_id INTEGER NOT NULL REFERENCES movement_items(id),
      quantity_returned INTEGER NOT NULL DEFAULT 0,
      condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (condition IN ('GOOD','REGULAR','DAMAGED','MAINTENANCE')),
      missing_quantity INTEGER NOT NULL DEFAULT 0,
      damaged_quantity INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS maintenances (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL REFERENCES equipments(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','FINISHED','CANCELLED')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expected_end_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      provider TEXT,
      description TEXT NOT NULL,
      cost REAL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      finished_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      description TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_backups (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipments(category_id);
    CREATE INDEX IF NOT EXISTS idx_movement_status ON movements(status);
    CREATE INDEX IF NOT EXISTS idx_movement_expected_return ON movements(expected_return_at);
    CREATE INDEX IF NOT EXISTS idx_movement_items_equipment ON movement_items(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_return_items_movement_item ON return_items(movement_item_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_status ON maintenances(equipment_id, status);
  `);

  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const adminExists = (await pool.query(`SELECT id FROM users WHERE email=$1`, [adminEmail])).rows[0];
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await pool.query(`INSERT INTO users (name,email,password_hash,role,is_active) VALUES ($1,$2,$3,'ADMIN',TRUE) ON CONFLICT (email) DO NOTHING`, ['Administrador', adminEmail, passwordHash]);
  }

  const categorySeed = [
    ['Câmera','CAM'], ['Tripé','TRI'], ['Fone intercomunicador','FON'], ['Conversor','CON'],
    ['Microfone','MIC'], ['Iluminação','ILU'], ['Monitor','MON'], ['Cabo/Acessório','CAB'],
    ['Bateria/Carregador','BAT'], ['Outros','OUT']
  ];
  for (const [name, prefix] of categorySeed) {
    await pool.query(`INSERT INTO categories (name,prefix) VALUES ($1,$2) ON CONFLICT (prefix) DO NOTHING`, [name, prefix]);
  }

  if (!env.SEED_DEMO) return;

  const admin = (await pool.query(`SELECT id FROM users WHERE email=$1`, [adminEmail])).rows[0];
  const operatorExists = (await pool.query(`SELECT id FROM users WHERE email='operador@controleav.local'`)).rows[0];
  if (!operatorExists) {
    const operatorHash = await bcrypt.hash('Operador@123', 12);
    await pool.query(`INSERT INTO users (name,email,password_hash,role,is_active) VALUES ('Operador','operador@controleav.local',$1,'OPERATOR',TRUE) ON CONFLICT (email) DO NOTHING`, [operatorHash]);
  }

  const catRows = (await pool.query(`SELECT id,prefix FROM categories`)).rows;
  const cat = Object.fromEntries(catRows.map(r => [r.prefix, r.id]));
  const equipmentSeed = [
    ['CAM-0001','Sony FX3','FX3','Sony','CAM','SN-FX3-001','UNIT',1,'GOOD',26999],
    ['CAM-0002','Sony FX6','FX6','Sony','CAM','SN-FX6-002','UNIT',1,'GOOD',47999],
    ['CAM-0003','Blackmagic Pocket Cinema 6K Pro','BMPCC 6K Pro','Blackmagic Design','CAM','SN-BM-003','UNIT',1,'GOOD',15999],
    ['TRI-0001','Tripé Manfrotto 504X','504X','Manfrotto','TRI','SN-TRI-001','UNIT',1,'GOOD',6490],
    ['TRI-0002','Tripé Benro KH26P','KH26P','Benro','TRI','SN-TRI-002','UNIT',1,'REGULAR',2190],
    ['FON-0001','Fone Intercom Hollyland','Solidcom C1','Hollyland','FON','SN-FON-001','UNIT',1,'GOOD',4100],
    ['FON-0002','Fone Intercom Hollyland','Solidcom C1','Hollyland','FON','SN-FON-002','UNIT',1,'GOOD',4100],
    ['CON-0001','Conversor SDI para HDMI','Micro Converter','Blackmagic Design','CON','SN-CON-001','UNIT',1,'GOOD',820],
    ['CON-0002','Conversor HDMI para SDI','Micro Converter','Blackmagic Design','CON','SN-CON-002','UNIT',1,'GOOD',820],
    ['MIC-0001','Microfone sem fio Rode','Wireless GO II','Rode','MIC','SN-MIC-001','UNIT',1,'GOOD',2490],
    ['MIC-0002','Microfone Shotgun','NTG5','Rode','MIC','SN-MIC-002','UNIT',1,'GOOD',2890],
    ['ILU-0001','Painel LED Aputure','Amaran P60x','Aputure','ILU','SN-ILU-001','UNIT',1,'GOOD',2650],
    ['ILU-0002','Luz COB Godox','SL100Bi','Godox','ILU','SN-ILU-002','UNIT',1,'GOOD',1950],
    ['MON-0001','Monitor de campo Atomos','Ninja V','Atomos','MON','SN-MON-001','UNIT',1,'GOOD',3890],
    ['CAB-0001','Cabo SDI 20 metros',null,'Canare','CAB',null,'BATCH',12,'GOOD',1800],
    ['CAB-0002','Cabo HDMI 10 metros',null,'Ugreen','CAB',null,'BATCH',10,'GOOD',1300],
    ['CAB-0003','Cabo XLR 10 metros',null,'Santo Angelo','CAB',null,'BATCH',15,'GOOD',1450],
    ['BAT-0001','Bateria Sony NP-FZ100','NP-FZ100','Sony','BAT',null,'BATCH',8,'GOOD',5200],
    ['BAT-0002','Bateria V-Mount 98Wh','VB99','SmallRig','BAT',null,'BATCH',6,'GOOD',7200],
    ['OUT-0001','Case rígido de transporte','Air 1535','Pelican','OUT','SN-CASE-001','UNIT',1,'GOOD',3290]
  ];
  for (const e of equipmentSeed) {
    await pool.query(`
      INSERT INTO equipments (internal_code,name,model,brand,category_id,serial_number,tracking_mode,total_quantity,condition,acquisition_date,acquisition_value,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (internal_code) DO NOTHING`,
      [e[0],e[1],e[2],e[3],cat[e[4] as string],e[5],e[6],e[7],e[8],new Date('2025-01-15'),e[9],admin.id]
    );
  }

  const now = new Date();
  const checkout1 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const overdue = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const checkout2 = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const cam = (await pool.query(`SELECT id FROM equipments WHERE internal_code='CAM-0001'`)).rows[0];
  const cable = (await pool.query(`SELECT id FROM equipments WHERE internal_code='CAB-0001'`)).rows[0];
  const rental = (await pool.query(`SELECT id FROM equipments WHERE internal_code='CAM-0002'`)).rows[0];

  await pool.query(`
    INSERT INTO movements (movement_code,type,status,responsible_name,destination,project_client,checkout_at,expected_return_at,notes,created_by)
    VALUES ('MOV-000001','EXTERNAL','OVERDUE','João Silva','Estádio Municipal','Transmissão esportiva',$1,$2,'Demo: saída atrasada',$3)
    ON CONFLICT (movement_code) DO NOTHING`, [checkout1, overdue, admin.id]);
  const m1 = (await pool.query(`SELECT id FROM movements WHERE movement_code='MOV-000001'`)).rows[0];
  await pool.query(`INSERT INTO movement_items (movement_id,equipment_id,quantity_out)
    SELECT $1,$2,1 WHERE NOT EXISTS (SELECT 1 FROM movement_items WHERE movement_id=$1 AND equipment_id=$2)`, [m1.id, cam.id]);
  await pool.query(`INSERT INTO movement_items (movement_id,equipment_id,quantity_out)
    SELECT $1,$2,4 WHERE NOT EXISTS (SELECT 1 FROM movement_items WHERE movement_id=$1 AND equipment_id=$2)`, [m1.id, cable.id]);

  await pool.query(`
    INSERT INTO movements (movement_code,type,status,responsible_name,destination,project_client,checkout_at,expected_return_at,renter_name,renter_document,renter_phone,rental_value,notes,created_by)
    VALUES ('MOV-000002','RENTAL','OPEN','Maria Costa','Studio Cliente','Publicidade',$1,$2,'Produtora Exemplo LTDA','00.000.000/0001-00','(98) 99999-0000',650,'Demo: aluguel ativo',$3)
    ON CONFLICT (movement_code) DO NOTHING`, [checkout2, future, admin.id]);
  const m2 = (await pool.query(`SELECT id FROM movements WHERE movement_code='MOV-000002'`)).rows[0];
  await pool.query(`INSERT INTO movement_items (movement_id,equipment_id,quantity_out)
    SELECT $1,$2,1 WHERE NOT EXISTS (SELECT 1 FROM movement_items WHERE movement_id=$1 AND equipment_id=$2)`, [m2.id, rental.id]);
}
