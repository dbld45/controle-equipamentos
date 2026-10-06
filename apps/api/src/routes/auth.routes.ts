import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/index.js';
import { users } from '../database/schema.js';
import { signToken } from '../lib/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAuth } from '../middlewares/auth.js';

export const authRoutes = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

authRoutes.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }
  const token = signToken({ sub: user.id, name: user.name, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

authRoutes.get('/me', requireAuth, asyncHandler(async (req, res) => res.json({ user: req.user })));
