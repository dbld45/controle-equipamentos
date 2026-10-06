import crypto from 'node:crypto';
import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool } from '../database/index.js';
import { movements } from '../database/schema.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { requireAuth } from '../middlewares/auth.js';
import { audit } from '../services/audit.service.js';

export const movementsRoutes = Router();
movementsRoutes.use(requireAuth);

const checkoutSchema = z.object({
  type: z.enum(['EXTERNAL','RENTAL']), responsibleName: z.string().min(2), responsibleUserId: z.number().int().positive().nullable().optional(),
  destination: z.string().min(2), projectClient: z.string().nullable().optional(), checkoutAt: z.coerce.date().optional(), expectedReturnAt: z.coerce.date(),
  renterName: z.string().nullable().optional(), renterDocument: z.string().nullable().optional(), renterPhone: z.string().nullable().optional(), rentalValue: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(), items: z.array(z.object({ equipmentId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1)
}).superRefine((data, ctx) => {
  if (data.type === 'RENTAL' && !data.renterName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['renterName'], message: 'Informe o locatário para aluguel.' });
  if (data.expectedReturnAt <= (data.checkoutAt ?? new Date())) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expectedReturnAt'], message: 'A previsão de retorno deve ser posterior à saída.' });
});

async function refreshOverdue() {
  await pool.query(`UPDATE movements SET status='OVERDUE', updated_at=NOW() WHERE status IN ('OPEN','PARTIALLY_RETURNED') AND expected_return_at < NOW()`);
}

movementsRoutes.get('/', asyncHandler(async (req, res) => {
  await refreshOverdue(); const status = req.query.status ? String(req.query.status) : undefined;
  const rows = status ? await db.select().from(movements).where(eq(movements.status, status as any)).orderBy(desc(movements.checkoutAt)) : await db.select().from(movements).orderBy(desc(movements.checkoutAt));
  res.json(rows);
}));
movementsRoutes.get('/overdue', asyncHandler(async (_req, res) => { await refreshOverdue(); res.json(await db.select().from(movements).where(eq(movements.status, 'OVERDUE')).orderBy(movements.expectedReturnAt)); }));
movementsRoutes.get('/active', asyncHandler(async (_req, res) => {
  await refreshOverdue();
  const rows = (await pool.query(`SELECT id,movement_code AS "movementCode",type,status,responsible_name AS "responsibleName",responsible_user_id AS "responsibleUserId",destination,project_client AS "projectClient",checkout_at AS "checkoutAt",expected_return_at AS "expectedReturnAt",renter_name AS "renterName",renter_document AS "renterDocument",renter_phone AS "renterPhone",rental_value AS "rentalValue",notes,created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM movements WHERE status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE') ORDER BY CASE WHEN status='OVERDUE' THEN 0 ELSE 1 END, expected_return_at ASC`)).rows;
  res.json(rows);
}));
movementsRoutes.get('/:id', asyncHandler(async (req, res) => {
  await refreshOverdue(); const id = Number(req.params.id); const movement = await db.query.movements.findFirst({ where: eq(movements.id, id) }); if (!movement) throw new HttpError(404, 'Movimentação não encontrada.');
  const items = (await pool.query(`SELECT mi.id,mi.equipment_id AS "equipmentId",e.internal_code AS "internalCode",e.name,e.brand,e.model,mi.quantity_out AS "quantityOut",COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0)::int AS "quantityReturned" FROM movement_items mi JOIN equipments e ON e.id=mi.equipment_id WHERE mi.movement_id=$1 ORDER BY e.internal_code`, [id])).rows;
  const returnRows = (await pool.query(`SELECT id,movement_id AS "movementId",returned_at AS "returnedAt",received_by AS "receivedBy",notes,created_at AS "createdAt" FROM returns WHERE movement_id=$1 ORDER BY returned_at DESC`, [id])).rows;
  res.json({ ...movement, items, returns: returnRows });
}));

movementsRoutes.post('/', asyncHandler(async (req, res) => {
  const input = checkoutSchema.parse(req.body); const merged = new Map<number, number>(); for (const item of input.items) merged.set(item.equipmentId, (merged.get(item.equipmentId) ?? 0) + item.quantity); const items = [...merged].map(([equipmentId, quantity]) => ({ equipmentId, quantity }));
  const client = await pool.connect(); let movementId = 0; let movementCode = '';
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const eqResult = await client.query(`SELECT id,internal_code,name,total_quantity,condition,is_active FROM equipments WHERE id=$1 FOR UPDATE`, [item.equipmentId]); const equipment = eqResult.rows[0];
      if (!equipment) throw new HttpError(404, `Equipamento ${item.equipmentId} não encontrado.`);
      if (!equipment.is_active || equipment.condition === 'WRITTEN_OFF') throw new HttpError(409, `${equipment.internal_code} está baixado/indisponível.`);
      if (equipment.condition === 'MAINTENANCE') throw new HttpError(409, `${equipment.internal_code} está marcado como em manutenção.`);
      const out = Number((await client.query(`SELECT COALESCE(SUM(mi.quantity_out),0) - COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri JOIN movement_items mi2 ON mi2.id=ri.movement_item_id JOIN movements m2 ON m2.id=mi2.movement_id WHERE mi2.equipment_id=$1 AND m2.status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE')),0) AS qty FROM movement_items mi JOIN movements m ON m.id=mi.movement_id WHERE mi.equipment_id=$1 AND m.status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE')`, [item.equipmentId])).rows[0].qty ?? 0);
      const maintenance = Number((await client.query(`SELECT COALESCE(SUM(quantity),0) AS qty FROM maintenances WHERE equipment_id=$1 AND status='OPEN'`, [item.equipmentId])).rows[0].qty ?? 0);
      const available = Number(equipment.total_quantity) - out - maintenance; if (item.quantity > available) throw new HttpError(409, `${equipment.internal_code} possui apenas ${available} unidade(s) disponível(is).`);
    }
    const seq = Number((await client.query(`SELECT nextval(pg_get_serial_sequence('movements','id')) AS id`)).rows[0].id); movementId = seq; movementCode = `MOV-${String(seq).padStart(6, '0')}`;
    await client.query(`INSERT INTO movements (id,movement_code,type,status,responsible_name,responsible_user_id,destination,project_client,checkout_at,expected_return_at,renter_name,renter_document,renter_phone,rental_value,notes,created_by) VALUES ($1,$2,$3,'OPEN',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [movementId,movementCode,input.type,input.responsibleName,input.responsibleUserId ?? null,input.destination,input.projectClient ?? null,input.checkoutAt ?? new Date(),input.expectedReturnAt,input.renterName ?? null,input.renterDocument ?? null,input.renterPhone ?? null,input.rentalValue ?? null,input.notes ?? null,req.user!.id]);
    for (const item of items) await client.query(`INSERT INTO movement_items (movement_id,equipment_id,quantity_out) VALUES ($1,$2,$3)`, [movementId,item.equipmentId,item.quantity]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  await audit({ req, action: 'CHECKOUT', entity: 'MOVEMENT', entityId: movementId, description: `Saída ${movementCode} registrada com ${items.length} item(ns).`, newData: { ...input, items } }); res.status(201).json({ id: movementId, movementCode });
}));

const returnSchema = z.object({
  returnedAt: z.coerce.date().optional(), notes: z.string().max(5000).nullable().optional(), items: z.array(z.object({
    movementItemId: z.number().int().positive(), quantityReturned: z.number().int().nonnegative(), condition: z.enum(['GOOD','REGULAR','DAMAGED','MAINTENANCE']).default('GOOD'), missingQuantity: z.number().int().nonnegative().default(0), damagedQuantity: z.number().int().nonnegative().default(0), notes: z.string().max(2000).nullable().optional()
  }).superRefine((item, ctx) => { if (item.quantityReturned === 0 && item.missingQuantity === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe quantidade devolvida ou faltante.' }); if (item.damagedQuantity > item.quantityReturned) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damagedQuantity'], message: 'Quantidade danificada não pode superar a quantidade devolvida.' }); })).min(1)
});

movementsRoutes.post('/:id/returns', asyncHandler(async (req, res) => {
  const movementId = Number(req.params.id); const input = returnSchema.parse(req.body); const returnedAt = input.returnedAt ?? new Date(); const client = await pool.connect(); let returnId = 0; let finalStatus = '';
  try {
    await client.query('BEGIN'); const movement = (await client.query(`SELECT * FROM movements WHERE id=$1 FOR UPDATE`, [movementId])).rows[0]; if (!movement) throw new HttpError(404, 'Movimentação não encontrada.'); if (['RETURNED','CANCELLED'].includes(movement.status)) throw new HttpError(409, 'Esta movimentação já foi encerrada.');
    for (const item of input.items) {
      const mi = (await client.query(`SELECT * FROM movement_items WHERE id=$1 AND movement_id=$2 FOR UPDATE`, [item.movementItemId,movementId])).rows[0]; if (!mi) throw new HttpError(400, `Item de movimentação ${item.movementItemId} inválido.`);
      const returned = Number((await client.query(`SELECT COALESCE(SUM(quantity_returned),0) AS qty FROM return_items WHERE movement_item_id=$1`, [item.movementItemId])).rows[0].qty ?? 0); const remaining = Number(mi.quantity_out) - returned;
      if (item.quantityReturned > remaining) throw new HttpError(409, `Devolução maior que o saldo pendente (${remaining}).`); if (item.quantityReturned + item.missingQuantity > remaining) throw new HttpError(409, `A conferência supera o saldo pendente (${remaining}).`); if (item.damagedQuantity > item.quantityReturned) throw new HttpError(422, 'Quantidade danificada não pode superar a quantidade devolvida.');
    }
    returnId = Number((await client.query(`INSERT INTO returns (movement_id,returned_at,received_by,notes) VALUES ($1,$2,$3,$4) RETURNING id`, [movementId,returnedAt,req.user!.id,input.notes ?? null])).rows[0].id);
    for (const item of input.items) {
      await client.query(`INSERT INTO return_items (return_id,movement_item_id,quantity_returned,condition,missing_quantity,damaged_quantity,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [returnId,item.movementItemId,item.quantityReturned,item.condition,item.missingQuantity,item.damagedQuantity,item.notes ?? null]);
      const equipmentId = Number((await client.query(`SELECT equipment_id FROM movement_items WHERE id=$1`, [item.movementItemId])).rows[0].equipment_id); const maintenanceQty = item.damagedQuantity > 0 ? item.damagedQuantity : item.condition === 'MAINTENANCE' ? item.quantityReturned : 0;
      if (maintenanceQty > 0) await client.query(`INSERT INTO maintenances (equipment_id,quantity,status,started_at,description,created_by) VALUES ($1,$2,'OPEN',$3,$4,$5)`, [equipmentId,maintenanceQty,returnedAt,`Aberta automaticamente na devolução #${returnId}. ${item.notes ?? ''}`.trim(),req.user!.id]);
    }
    const pending = Number((await client.query(`SELECT COALESCE(SUM(mi.quantity_out),0) - COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri JOIN movement_items mi2 ON mi2.id=ri.movement_item_id WHERE mi2.movement_id=$1),0) AS qty FROM movement_items mi WHERE mi.movement_id=$1`, [movementId])).rows[0].qty ?? 0);
    finalStatus = pending <= 0 ? 'RETURNED' : new Date(movement.expected_return_at).getTime() < Date.now() ? 'OVERDUE' : 'PARTIALLY_RETURNED'; await client.query(`UPDATE movements SET status=$1,updated_at=NOW() WHERE id=$2`, [finalStatus,movementId]); await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  await audit({ req, action: 'CHECKIN', entity: 'MOVEMENT', entityId: movementId, description: `Devolução #${returnId} registrada.`, newData: input }); res.status(201).json({ returnId, status: finalStatus });
}));
