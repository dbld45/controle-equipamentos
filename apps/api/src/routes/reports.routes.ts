import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../database/index.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middlewares/auth.js';

export const reportsRoutes = Router();
reportsRoutes.use(requireAuth);
const querySchema = z.object({ type: z.enum(['inventory','out','overdue','history','usage']).default('inventory'), start: z.coerce.date().optional(), end: z.coerce.date().optional() });
async function refreshOverdue() { await pool.query(`UPDATE movements SET status='OVERDUE',updated_at=NOW() WHERE status IN ('OPEN','PARTIALLY_RETURNED') AND expected_return_at < NOW()`); }
function resolvePeriod(start?: Date,end?: Date) { const now=new Date(); const from=start ?? new Date(now.getFullYear(),now.getMonth(),1); const raw=end ?? now; const to=new Date(raw.getFullYear(),raw.getMonth(),raw.getDate(),23,59,59,999); return { from,to }; }

reportsRoutes.get('/', asyncHandler(async (req,res) => {
  await refreshOverdue(); const input=querySchema.parse(req.query); const {from,to}=resolvePeriod(input.start,input.end);
  if (input.type==='inventory') {
    const rows=(await pool.query(`SELECT e.id,e.internal_code AS "internalCode",e.name,e.brand,e.model,c.name AS category,e.tracking_mode AS "trackingMode",e.total_quantity AS "totalQuantity",e.condition,e.is_active AS "isActive",
      COALESCE((SELECT SUM(mi.quantity_out) FROM movement_items mi JOIN movements m ON m.id=mi.movement_id WHERE mi.equipment_id=e.id AND m.status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE')),0)::int - COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri JOIN movement_items mi2 ON mi2.id=ri.movement_item_id JOIN movements m2 ON m2.id=mi2.movement_id WHERE mi2.equipment_id=e.id AND m2.status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE')),0)::int AS "quantityOut",
      COALESCE((SELECT SUM(ma.quantity) FROM maintenances ma WHERE ma.equipment_id=e.id AND ma.status='OPEN'),0)::int AS "maintenanceQuantity"
      FROM equipments e JOIN categories c ON c.id=e.category_id ORDER BY c.name,e.internal_code`)).rows;
    const data=rows.map((row:any)=>{ const out=Number(row.quantityOut??0),maintenance=Number(row.maintenanceQuantity??0),available=Math.max(0,Number(row.totalQuantity)-out-maintenance); let status='Disponível'; if(!row.isActive||row.condition==='WRITTEN_OFF')status='Baixado'; else if(maintenance>=Number(row.totalQuantity))status='Em manutenção'; else if(out>0&&available>0)status='Fora parcialmente'; else if(out>0)status='Fora do estoque'; return {...row,quantityOut:out,maintenanceQuantity:maintenance,availableQuantity:available,status}; });
    return res.json({type:input.type,generatedAt:new Date(),data});
  }
  if (input.type==='out'||input.type==='overdue') {
    const statusFilter=input.type==='overdue'?`AND m.status='OVERDUE'`:`AND m.status IN ('OPEN','PARTIALLY_RETURNED','OVERDUE')`;
    const data=(await pool.query(`SELECT m.id AS "movementId",m.movement_code AS "movementCode",m.type,m.status,m.responsible_name AS "responsibleName",m.destination,m.project_client AS "projectClient",m.checkout_at AS "checkoutAt",m.expected_return_at AS "expectedReturnAt",e.internal_code AS "internalCode",e.name AS "equipmentName",c.name AS category,mi.quantity_out AS "quantityOut",COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0)::int AS "quantityReturned",mi.quantity_out-COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0)::int AS "quantityPending" FROM movements m JOIN movement_items mi ON mi.movement_id=m.id JOIN equipments e ON e.id=mi.equipment_id JOIN categories c ON c.id=e.category_id WHERE (mi.quantity_out-COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0))>0 ${statusFilter} ORDER BY CASE WHEN m.status='OVERDUE' THEN 0 ELSE 1 END,m.expected_return_at ASC,m.movement_code,e.internal_code`)).rows;
    return res.json({type:input.type,generatedAt:new Date(),data});
  }
  if (input.type==='history') {
    const data=(await pool.query(`SELECT m.id AS "movementId",m.movement_code AS "movementCode",m.type,m.status,m.responsible_name AS "responsibleName",m.destination,m.project_client AS "projectClient",m.checkout_at AS "checkoutAt",m.expected_return_at AS "expectedReturnAt",m.renter_name AS "renterName",m.rental_value AS "rentalValue",e.internal_code AS "internalCode",e.name AS "equipmentName",c.name AS category,mi.quantity_out AS "quantityOut",COALESCE((SELECT SUM(ri.quantity_returned) FROM return_items ri WHERE ri.movement_item_id=mi.id),0)::int AS "quantityReturned" FROM movements m JOIN movement_items mi ON mi.movement_id=m.id JOIN equipments e ON e.id=mi.equipment_id JOIN categories c ON c.id=e.category_id WHERE m.checkout_at BETWEEN $1 AND $2 ORDER BY m.checkout_at DESC,m.movement_code,e.internal_code`,[from,to])).rows;
    return res.json({type:input.type,generatedAt:new Date(),period:{from,to},data});
  }
  const data=(await pool.query(`SELECT e.id AS "equipmentId",e.internal_code AS "internalCode",e.name AS "equipmentName",c.name AS category,COUNT(DISTINCT m.id)::int AS "movementCount",COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN mi.quantity_out ELSE 0 END),0)::int AS "quantityMoved",COALESCE(SUM(CASE WHEN m.type='EXTERNAL' THEN mi.quantity_out ELSE 0 END),0)::int AS "externalQuantity",COALESCE(SUM(CASE WHEN m.type='RENTAL' THEN mi.quantity_out ELSE 0 END),0)::int AS "rentalQuantity",MAX(m.checkout_at) AS "lastUseAt" FROM equipments e JOIN categories c ON c.id=e.category_id LEFT JOIN movement_items mi ON mi.equipment_id=e.id LEFT JOIN movements m ON m.id=mi.movement_id AND m.checkout_at BETWEEN $1 AND $2 AND m.status<>'CANCELLED' GROUP BY e.id,c.name HAVING COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN mi.quantity_out ELSE 0 END),0)>0 ORDER BY "quantityMoved" DESC,"movementCount" DESC,e.internal_code`,[from,to])).rows;
  res.json({type:input.type,generatedAt:new Date(),period:{from,to},data});
}));
