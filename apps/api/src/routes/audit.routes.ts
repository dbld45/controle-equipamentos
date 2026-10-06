import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../database/index.js';
import { auditLogs } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';

export const auditRoutes = Router();
auditRoutes.use(requireAuth, requireAdmin);

auditRoutes.get('/', asyncHandler(async (req, res) => {
  const entity = req.query.entity ? String(req.query.entity) : undefined;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
  const rows = entity
    ? await db.select().from(auditLogs).where(eq(auditLogs.entity, entity)).orderBy(desc(auditLogs.createdAt)).limit(limit)
    : await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  res.json(rows);
}));
