import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db, pool } from '../database/index.js';
import { categories, equipments } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middlewares/auth.js';
import { getInventorySnapshot, getQuantitiesByMovementType } from '../services/inventory.service.js';

export const dashboardRoutes = Router();
dashboardRoutes.use(requireAuth);

dashboardRoutes.get('/', asyncHandler(async (_req, res) => {
  await pool.query(`UPDATE movements SET status='OVERDUE', updated_at=NOW() WHERE status IN ('OPEN','PARTIALLY_RETURNED') AND expected_return_at < NOW()`);
  const all = await db.select().from(equipments);
  let totalUnits=0, available=0, external=0, rental=0, maintenance=0, writtenOff=0;
  for (const e of all) {
    totalUnits += e.totalQuantity;
    if (!e.isActive || e.condition === 'WRITTEN_OFF') { writtenOff += e.totalQuantity; continue; }
    const inv = await getInventorySnapshot(e.id); const types = await getQuantitiesByMovementType(e.id);
    available += inv?.available ?? 0; maintenance += inv?.maintenance ?? 0; external += types.external; rental += types.rental;
  }
  const overdue = Number((await pool.query(`SELECT COUNT(*)::int AS count FROM movements WHERE status='OVERDUE'`)).rows[0].count);
  const byCategory = await db.select({ category: categories.name, total: sql<number>`coalesce(sum(${equipments.totalQuantity}),0)` }).from(equipments).innerJoin(categories, sql`${categories.id}=${equipments.categoryId}`).groupBy(categories.id).orderBy(categories.name);
  const recentMovements = (await pool.query(`SELECT id,movement_code AS "movementCode",type,status,responsible_name AS "responsibleName",destination,checkout_at AS "checkoutAt",expected_return_at AS "expectedReturnAt" FROM movements ORDER BY checkout_at DESC LIMIT 8`)).rows;
  res.json({ counters: { totalUnits,available,external,rental,maintenance,overdue,writtenOff }, byCategory: byCategory.map(x => ({ ...x, total: Number(x.total) })), recentMovements });
}));
