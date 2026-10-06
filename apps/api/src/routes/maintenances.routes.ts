import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../database/index.js';
import { maintenances } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';
import { getInventorySnapshot } from '../services/inventory.service.js';

export const maintenancesRoutes = Router();
maintenancesRoutes.use(requireAuth);

maintenancesRoutes.get('/', asyncHandler(async (_req, res) => res.json(await db.select().from(maintenances).orderBy(desc(maintenances.startedAt)))));

const createSchema = z.object({ equipmentId: z.number().int().positive(), quantity: z.number().int().positive().default(1), expectedEndAt: z.coerce.date().nullable().optional(), provider: z.string().nullable().optional(), description: z.string().min(2), cost: z.number().nonnegative().nullable().optional() });
maintenancesRoutes.post('/', asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const inv = await getInventorySnapshot(input.equipmentId);
  if (!inv) throw new HttpError(404, 'Equipamento não encontrado.');
  if (input.quantity > inv.available) throw new HttpError(409, `Há apenas ${inv.available} unidade(s) disponível(is) para manutenção.`);
  const [created] = await db.insert(maintenances).values({ ...input, createdBy: req.user!.id }).returning();
  await audit({ req, action: 'OPEN_MAINTENANCE', entity: 'MAINTENANCE', entityId: created.id, description: `Manutenção aberta para ${inv.equipment.internalCode}.`, newData: created });
  res.status(201).json(created);
}));

maintenancesRoutes.post('/:id/finish', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const old = await db.query.maintenances.findFirst({ where: eq(maintenances.id, id) });
  if (!old) throw new HttpError(404, 'Manutenção não encontrada.');
  if (old.status !== 'OPEN') throw new HttpError(409, 'Esta manutenção já foi encerrada.');
  const [updated] = await db.update(maintenances).set({ status: 'FINISHED', finishedAt: new Date(), finishedBy: req.user!.id, updatedAt: new Date() }).where(eq(maintenances.id, id)).returning();
  await audit({ req, action: 'FINISH_MAINTENANCE', entity: 'MAINTENANCE', entityId: id, description: 'Manutenção encerrada.', oldData: old, newData: updated });
  res.json(updated);
}));
