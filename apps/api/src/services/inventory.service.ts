import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../database/index.js';
import { equipments, maintenances, movementItems, movements, returnItems, returns } from '../database/schema.js';

export async function getInventorySnapshot(equipmentId: number) {
  const equipment = await db.query.equipments.findFirst({ where: eq(equipments.id, equipmentId) });
  if (!equipment) return null;

  const [outRow] = await db
    .select({ value: sql<number>`coalesce(sum(${movementItems.quantityOut}), 0)` })
    .from(movementItems)
    .innerJoin(movements, eq(movements.id, movementItems.movementId))
    .where(and(eq(movementItems.equipmentId, equipmentId), inArray(movements.status, ['OPEN', 'PARTIALLY_RETURNED', 'OVERDUE'])));

  const [returnedRow] = await db
    .select({ value: sql<number>`coalesce(sum(${returnItems.quantityReturned}), 0)` })
    .from(returnItems)
    .innerJoin(movementItems, eq(movementItems.id, returnItems.movementItemId))
    .innerJoin(returns, eq(returns.id, returnItems.returnId))
    .innerJoin(movements, eq(movements.id, movementItems.movementId))
    .where(and(eq(movementItems.equipmentId, equipmentId), inArray(movements.status, ['OPEN', 'PARTIALLY_RETURNED', 'OVERDUE'])));

  const [maintenanceRow] = await db
    .select({ value: sql<number>`coalesce(sum(${maintenances.quantity}), 0)` })
    .from(maintenances)
    .where(and(eq(maintenances.equipmentId, equipmentId), eq(maintenances.status, 'OPEN')));

  const quantityOut = Number(outRow?.value ?? 0) - Number(returnedRow?.value ?? 0);
  const trackedMaintenance = Number(maintenanceRow?.value ?? 0);
  const maintenance = equipment.condition === 'MAINTENANCE' ? equipment.totalQuantity : trackedMaintenance;
  const available = Math.max(0, equipment.totalQuantity - quantityOut - maintenance);

  return { equipment, total: equipment.totalQuantity, out: quantityOut, maintenance, available };
}

export async function getQuantitiesByMovementType(equipmentId: number) {
  const rows = await db
    .select({ type: movements.type, qty: sql<number>`coalesce(sum(${movementItems.quantityOut}), 0)` })
    .from(movementItems)
    .innerJoin(movements, eq(movements.id, movementItems.movementId))
    .where(and(eq(movementItems.equipmentId, equipmentId), inArray(movements.status, ['OPEN', 'PARTIALLY_RETURNED', 'OVERDUE'])))
    .groupBy(movements.type);

  let external = 0;
  let rental = 0;
  for (const row of rows) {
    if (row.type === 'EXTERNAL') external += Number(row.qty);
    if (row.type === 'RENTAL') rental += Number(row.qty);
  }

  const [returnedExternal] = await db.select({ qty: sql<number>`coalesce(sum(${returnItems.quantityReturned}),0)` })
    .from(returnItems)
    .innerJoin(movementItems, eq(movementItems.id, returnItems.movementItemId))
    .innerJoin(movements, eq(movements.id, movementItems.movementId))
    .where(and(eq(movementItems.equipmentId, equipmentId), eq(movements.type, 'EXTERNAL'), inArray(movements.status, ['OPEN', 'PARTIALLY_RETURNED', 'OVERDUE'])));
  const [returnedRental] = await db.select({ qty: sql<number>`coalesce(sum(${returnItems.quantityReturned}),0)` })
    .from(returnItems)
    .innerJoin(movementItems, eq(movementItems.id, returnItems.movementItemId))
    .innerJoin(movements, eq(movements.id, movementItems.movementId))
    .where(and(eq(movementItems.equipmentId, equipmentId), eq(movements.type, 'RENTAL'), inArray(movements.status, ['OPEN', 'PARTIALLY_RETURNED', 'OVERDUE'])));

  return {
    external: Math.max(0, external - Number(returnedExternal?.qty ?? 0)),
    rental: Math.max(0, rental - Number(returnedRental?.qty ?? 0))
  };
}
