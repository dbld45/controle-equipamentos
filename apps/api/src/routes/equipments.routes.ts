import { Router } from 'express';
import multer from 'multer';
import { and, desc, eq, ilike, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db, pool } from '../database/index.js';
import { categories, equipments, movementItems } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';
import { getInventorySnapshot, getQuantitiesByMovementType } from '../services/inventory.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.PHOTO_MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

export const equipmentsRoutes = Router();
equipmentsRoutes.use(requireAuth);

const equipmentBaseSchema = z.object({
  name: z.string().min(2).max(120), model: z.string().max(120).nullable().optional(), brand: z.string().max(100).nullable().optional(),
  categoryId: z.coerce.number().int().positive(), serialNumber: z.string().max(120).nullable().optional(),
  trackingMode: z.enum(['UNIT', 'BATCH']).default('UNIT'), totalQuantity: z.coerce.number().int().positive().default(1),
  condition: z.enum(['NEW', 'GOOD', 'REGULAR', 'MAINTENANCE', 'WRITTEN_OFF']).default('GOOD'),
  acquisitionDate: z.coerce.date().nullable().optional(), acquisitionValue: z.coerce.number().nonnegative().nullable().optional(), notes: z.string().max(5000).nullable().optional()
});
const equipmentSchema = equipmentBaseSchema.superRefine((data, ctx) => {
  if (data.trackingMode === 'UNIT' && data.totalQuantity !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['totalQuantity'], message: 'Item unitário deve ter quantidade total igual a 1.' });
});
function normalizeEquipmentBody(input: Record<string, any>) {
  const body = { ...input };
  for (const key of ['model','brand','serialNumber','acquisitionDate','acquisitionValue','notes']) if (body[key] === '') body[key] = null;
  if (typeof body.totalQuantity === 'string' && body.totalQuantity) body.totalQuantity = Number(body.totalQuantity);
  if (typeof body.categoryId === 'string' && body.categoryId) body.categoryId = Number(body.categoryId);
  if (typeof body.acquisitionValue === 'string' && body.acquisitionValue) body.acquisitionValue = Number(body.acquisitionValue);
  return body;
}
function photoData(file?: Express.Multer.File) {
  return file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : undefined;
}
async function nextInternalCode(categoryId: number) {
  const category = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!category || !category.isActive) throw new HttpError(400, 'Categoria inválida ou inativa.');
  const rows = await db.select({ code: equipments.internalCode }).from(equipments).where(like(equipments.internalCode, `${category.prefix}-%`)).orderBy(desc(equipments.id)).limit(1000);
  let max = 0;
  for (const row of rows) { const n = Number(row.code.split('-').pop()); if (Number.isFinite(n)) max = Math.max(max, n); }
  return `${category.prefix}-${String(max + 1).padStart(4, '0')}`;
}

equipmentsRoutes.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const condition = req.query.condition ? String(req.query.condition) : undefined;
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  const sortBy = String(req.query.sortBy ?? 'internalCode');
  const sortOrder = String(req.query.sortOrder ?? 'asc') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize ?? 25)));
  const filters: any[] = [];
  if (q) filters.push(or(ilike(equipments.internalCode, `%${q}%`), ilike(equipments.name, `%${q}%`), ilike(equipments.brand, `%${q}%`), ilike(equipments.model, `%${q}%`)));
  if (categoryId) filters.push(eq(equipments.categoryId, categoryId));
  if (condition) filters.push(eq(equipments.condition, condition as any));
  const rows = await db.select({ equipment: equipments, category: categories }).from(equipments).innerJoin(categories, eq(categories.id, equipments.categoryId)).where(filters.length ? and(...filters) : undefined);
  let items = await Promise.all(rows.map(async ({ equipment, category }) => {
    const inventory = await getInventorySnapshot(equipment.id); const byType = await getQuantitiesByMovementType(equipment.id);
    let computedStatus = 'AVAILABLE';
    if (!equipment.isActive || equipment.condition === 'WRITTEN_OFF') computedStatus = 'WRITTEN_OFF';
    else if ((inventory?.maintenance ?? 0) >= equipment.totalQuantity) computedStatus = 'MAINTENANCE';
    else if (byType.external > 0 && (inventory?.available ?? 0) > 0) computedStatus = 'EXTERNAL_PARTIAL';
    else if (byType.rental > 0 && (inventory?.available ?? 0) > 0) computedStatus = 'RENTAL_PARTIAL';
    else if (byType.external > 0) computedStatus = 'EXTERNAL';
    else if (byType.rental > 0) computedStatus = 'RENTAL';
    return { ...equipment, photoPath: null, category, inventory: { ...inventory, equipment: undefined }, quantities: byType, status: computedStatus };
  }));
  if (status) items = items.filter(item => status === 'EXTERNAL' ? ['EXTERNAL','EXTERNAL_PARTIAL'].includes(item.status) : status === 'RENTAL' ? ['RENTAL','RENTAL_PARTIAL'].includes(item.status) : item.status === status);
  const sortable = new Set(['internalCode','name','brand','category','status','available','totalQuantity']); const selectedSort = sortable.has(sortBy) ? sortBy : 'internalCode';
  items.sort((a: any, b: any) => { const av = selectedSort === 'category' ? a.category.name : selectedSort === 'available' ? a.inventory.available : a[selectedSort]; const bv = selectedSort === 'category' ? b.category.name : selectedSort === 'available' ? b.inventory.available : b[selectedSort]; const r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { numeric: true }); return sortOrder === 'desc' ? -r : r; });
  const total = items.length; res.json({ items: items.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
}));

equipmentsRoutes.get('/barcode/:code', asyncHandler(async (req, res) => {
  const equipment = await db.query.equipments.findFirst({ where: eq(equipments.internalCode, String(req.params.code).trim().toUpperCase()) });
  if (!equipment) throw new HttpError(404, 'Equipamento não encontrado para este código.');
  const inventory = await getInventorySnapshot(equipment.id); const quantities = await getQuantitiesByMovementType(equipment.id);
  res.json({ equipment: { ...equipment, photoPath: null }, inventory: { ...inventory, equipment: undefined }, quantities });
}));

equipmentsRoutes.get('/:id/history', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const equipment = await db.query.equipments.findFirst({ where: eq(equipments.id, id) });
  if (!equipment) throw new HttpError(404, 'Equipamento não encontrado.');
  const movementHistory = (await pool.query(`
    SELECT m.id AS "movementId", m.movement_code AS "movementCode", m.type, m.status,
      m.responsible_name AS "responsibleName", m.destination, m.project_client AS "projectClient",
      m.checkout_at AS "checkoutAt", m.expected_return_at AS "expectedReturnAt", mi.id AS "movementItemId",
      mi.quantity_out AS "quantityOut", COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0)::int AS "quantityReturned"
    FROM movement_items mi JOIN movements m ON m.id=mi.movement_id WHERE mi.equipment_id=$1 ORDER BY m.checkout_at DESC`, [id])).rows;
  const maintenanceHistory = (await pool.query(`SELECT id,quantity,status,started_at AS "startedAt",expected_end_at AS "expectedEndAt",finished_at AS "finishedAt",provider,description,cost FROM maintenances WHERE equipment_id=$1 ORDER BY started_at DESC`, [id])).rows;
  res.json({ movementHistory, maintenanceHistory });
}));

equipmentsRoutes.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const equipment = await db.query.equipments.findFirst({ where: eq(equipments.id, id) });
  if (!equipment) throw new HttpError(404, 'Equipamento não encontrado.');
  const category = await db.query.categories.findFirst({ where: eq(categories.id, equipment.categoryId) }); const inventory = await getInventorySnapshot(id); const quantities = await getQuantitiesByMovementType(id);
  res.json({ ...equipment, category, inventory: { ...inventory, equipment: undefined }, quantities, barcodeValue: equipment.internalCode });
}));

equipmentsRoutes.post('/', upload.single('photo'), asyncHandler(async (req, res) => {
  const input = equipmentSchema.parse(normalizeEquipmentBody(req.body)); const internalCode = await nextInternalCode(input.categoryId);
  try {
    const [created] = await db.insert(equipments).values({ ...input, internalCode, photoPath: photoData(req.file) ?? null, createdBy: req.user!.id }).returning();
    await audit({ req, action: 'CREATE_EQUIPMENT', entity: 'EQUIPMENT', entityId: created.id, description: `Equipamento ${created.internalCode} criado.`, newData: created }); res.status(201).json(created);
  } catch { throw new HttpError(409, 'Não foi possível cadastrar. Verifique código ou número de série duplicado.'); }
}));

equipmentsRoutes.patch('/:id', upload.single('photo'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const old = await db.query.equipments.findFirst({ where: eq(equipments.id, id) }); if (!old) throw new HttpError(404, 'Equipamento não encontrado.');
  const partial = equipmentBaseSchema.partial().parse(normalizeEquipmentBody(req.body)); const inventory = await getInventorySnapshot(id);
  if (partial.totalQuantity !== undefined && partial.totalQuantity < old.totalQuantity - (inventory?.available ?? 0)) throw new HttpError(409, 'A nova quantidade total é menor que a quantidade atualmente comprometida.');
  if (partial.condition === 'MAINTENANCE' && old.condition !== 'MAINTENANCE' && (inventory?.available ?? 0) !== old.totalQuantity) throw new HttpError(409, 'Só é possível marcar o equipamento inteiro como em manutenção quando todas as unidades estão no estoque.');
  const [updated] = await db.update(equipments).set({ ...partial, ...(req.file ? { photoPath: photoData(req.file) } : {}), updatedAt: new Date() }).where(eq(equipments.id, id)).returning();
  await audit({ req, action: 'UPDATE_EQUIPMENT', entity: 'EQUIPMENT', entityId: id, description: `Equipamento ${old.internalCode} alterado.`, oldData: old, newData: updated }); res.json(updated);
}));

equipmentsRoutes.post('/:id/write-off', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const equipment = await db.query.equipments.findFirst({ where: eq(equipments.id, id) }); if (!equipment) throw new HttpError(404, 'Equipamento não encontrado.');
  const inventory = await getInventorySnapshot(id); if ((inventory?.available ?? 0) !== equipment.totalQuantity) throw new HttpError(409, 'Não é possível baixar um equipamento com unidades fora do estoque ou em manutenção.');
  await db.update(equipments).set({ condition: 'WRITTEN_OFF', isActive: false, updatedAt: new Date() }).where(eq(equipments.id, id));
  await audit({ req, action: 'WRITE_OFF_EQUIPMENT', entity: 'EQUIPMENT', entityId: id, description: `Equipamento ${equipment.internalCode} baixado.`, oldData: equipment, newData: { condition: 'WRITTEN_OFF', isActive: false } }); res.json({ ok: true });
}));

equipmentsRoutes.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id); const linked = await db.query.movementItems.findFirst({ where: eq(movementItems.equipmentId, id) });
  if (linked) throw new HttpError(409, 'Este equipamento possui histórico e não pode ser excluído. Use a função de baixa.');
  const equipment = await db.query.equipments.findFirst({ where: eq(equipments.id, id) }); if (!equipment) throw new HttpError(404, 'Equipamento não encontrado.');
  await db.delete(equipments).where(eq(equipments.id, id)); await audit({ req, action: 'DELETE_EQUIPMENT', entity: 'EQUIPMENT', entityId: id, description: `Equipamento ${equipment.internalCode} excluído por não possuir histórico.`, oldData: equipment }); res.status(204).end();
}));
