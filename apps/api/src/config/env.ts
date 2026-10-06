import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres.'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória. Conecte um Postgres/Neon no Vercel.'),
  CORS_ORIGIN: z.string().default('*'),
  ADMIN_EMAIL: z.string().email().default('admin@controleav.local'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD deve ter pelo menos 8 caracteres.'),
  SEED_DEMO: z.string().default('true').transform(v => v === 'true'),
  PHOTO_MAX_MB: z.coerce.number().positive().max(5).default(2)
});

export const env = schema.parse(process.env);
