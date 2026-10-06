import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/index.js';
import { categories, equipments } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';

export const categoriesRoutes = Router();
categoriesRoutes.use(requireAuth);

categoriesRoutes.get('/', asyncHandler(async (_req, res) => {
  res.json(await db.select().from(categories).orderBy(asc(categories.name)));
}));

const categorySchema = z.object({ name: z.string().min(2).max(60), prefix: z.string().min(2).max(5).regex(/^[A-Z0-9]+$/), isActive: z.boolean().optional() });

categoriesRoutes.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const input = categorySchema.parse({ ...req.body, prefix: String(req.body.prefix ?? '').toUpperCase() });
  try {
    const [created] = await db.insert(categories).values(input).returning();
    await audit({ req, action: 'CREATE_CATEGORY', entity: 'CATEGORY', entityId: created.id, description: `Categoria ${created.name} criada.`, newData: created });
    res.status(201).json(created);
  } catch (e) {
    throw new HttpError(409, 'Nome ou prefixo de categoria já está em uso.');
  }
}));

categoriesRoutes.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const old = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!old) throw new HttpError(404, 'Categoria não encontrada.');
  const input = categorySchema.partial().parse({ ...req.body, ...(req.body.prefix ? { prefix: String(req.body.prefix).toUpperCase() } : {}) });
  const [updated] = await db.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  await audit({ req, action: 'UPDATE_CATEGORY', entity: 'CATEGORY', entityId: id, description: `Categoria ${old.name} alterada.`, oldData: old, newData: updated });
  res.json(updated);
}));

categoriesRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const linked = await db.query.equipments.findFirst({ where: eq(equipments.categoryId, id) });
  if (linked) throw new HttpError(409, 'Categoria possui equipamentos vinculados. Desative-a em vez de excluir.');
  await db.delete(categories).where(eq(categories.id, id));
  await audit({ req, action: 'DELETE_CATEGORY', entity: 'CATEGORY', entityId: id, description: 'Categoria excluída.' });
  res.status(204).end();
}));
