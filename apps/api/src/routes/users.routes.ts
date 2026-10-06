import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/index.js';
import { users } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';

export const usersRoutes = Router();
usersRoutes.use(requireAuth, requireAdmin);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'OPERATOR']).default('OPERATOR')
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'OPERATOR']).optional(),
  isActive: z.boolean().optional()
});

async function countOtherActiveAdmins(id: number) {
  const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true), ne(users.id, id)));
  return rows.length;
}

usersRoutes.get('/', asyncHandler(async (_req, res) => {
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users);
  res.json(rows);
}));

usersRoutes.post('/', asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const email = input.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [created] = await db.insert(users).values({ name: input.name, email, passwordHash, role: input.role }).returning();
  await audit({ req, action: 'CREATE_USER', entity: 'USER', entityId: created.id, description: `Usuário ${created.email} criado.`, newData: { id: created.id, name: created.name, email: created.email, role: created.role } });
  res.status(201).json({ id: created.id, name: created.name, email: created.email, role: created.role, isActive: created.isActive, createdAt: created.createdAt, updatedAt: created.updatedAt });
}));

usersRoutes.patch('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const input = updateSchema.parse(req.body);
  const old = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!old) throw new HttpError(404, 'Usuário não encontrado.');

  if ((input.isActive === false || input.role === 'OPERATOR') && old.role === 'ADMIN' && old.isActive) {
    if (await countOtherActiveAdmins(id) === 0) throw new HttpError(409, 'O sistema precisa manter pelo menos um administrador ativo.');
  }
  if (req.user!.id === id && input.isActive === false) throw new HttpError(400, 'Você não pode desativar seu próprio usuário.');

  const email = input.email?.toLowerCase();
  if (email && email !== old.email) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
  }

  const patch: { name?: string; email?: string; role?: 'ADMIN' | 'OPERATOR'; isActive?: boolean; passwordHash?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (email !== undefined) patch.email = email;
  if (input.role !== undefined) patch.role = input.role;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.password !== undefined) patch.passwordHash = await bcrypt.hash(input.password, 12);

  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  await audit({
    req, action: 'UPDATE_USER', entity: 'USER', entityId: id, description: `Usuário ${updated.email} alterado.`,
    oldData: { id: old.id, name: old.name, email: old.email, role: old.role, isActive: old.isActive },
    newData: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, passwordChanged: input.password !== undefined }
  });
  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
}));

usersRoutes.patch('/:id/status', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const old = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!old) throw new HttpError(404, 'Usuário não encontrado.');
  if (req.user!.id === id && !isActive) throw new HttpError(400, 'Você não pode desativar seu próprio usuário.');
  if (!isActive && old.role === 'ADMIN' && old.isActive && await countOtherActiveAdmins(id) === 0) throw new HttpError(409, 'O sistema precisa manter pelo menos um administrador ativo.');
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id));
  await audit({ req, action: 'UPDATE_USER_STATUS', entity: 'USER', entityId: id, description: `Status do usuário ${old.email} alterado.`, oldData: { isActive: old.isActive }, newData: { isActive } });
  res.json({ ok: true });
}));
