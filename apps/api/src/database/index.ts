import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });
attachDatabasePool(pool);
export const db = drizzle(pool, { schema });
