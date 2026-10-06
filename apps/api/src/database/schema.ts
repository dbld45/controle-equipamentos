import { boolean, integer, pgTable, real, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['ADMIN', 'OPERATOR'] }).notNull().default('OPERATOR'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps
}, t => ({ emailIdx: uniqueIndex('users_email_unique').on(t.email) }));

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps
}, t => ({ nameIdx: uniqueIndex('categories_name_unique').on(t.name), prefixIdx: uniqueIndex('categories_prefix_unique').on(t.prefix) }));

export const equipments = pgTable('equipments', {
  id: serial('id').primaryKey(),
  internalCode: text('internal_code').notNull(),
  name: text('name').notNull(),
  model: text('model'),
  brand: text('brand'),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  serialNumber: text('serial_number'),
  trackingMode: text('tracking_mode', { enum: ['UNIT', 'BATCH'] }).notNull().default('UNIT'),
  totalQuantity: integer('total_quantity').notNull().default(1),
  condition: text('condition', { enum: ['NEW', 'GOOD', 'REGULAR', 'MAINTENANCE', 'WRITTEN_OFF'] }).notNull().default('GOOD'),
  acquisitionDate: timestamp('acquisition_date', { withTimezone: true }),
  acquisitionValue: real('acquisition_value'),
  photoPath: text('photo_path'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  ...timestamps
}, t => ({ codeIdx: uniqueIndex('equipments_internal_code_unique').on(t.internalCode), serialIdx: uniqueIndex('equipments_serial_number_unique').on(t.serialNumber) }));

export const movements = pgTable('movements', {
  id: serial('id').primaryKey(),
  movementCode: text('movement_code').notNull(),
  type: text('type', { enum: ['EXTERNAL', 'RENTAL'] }).notNull(),
  status: text('status', { enum: ['OPEN', 'PARTIALLY_RETURNED', 'RETURNED', 'OVERDUE', 'CANCELLED'] }).notNull().default('OPEN'),
  responsibleName: text('responsible_name').notNull(),
  responsibleUserId: integer('responsible_user_id').references(() => users.id),
  destination: text('destination').notNull(),
  projectClient: text('project_client'),
  checkoutAt: timestamp('checkout_at', { withTimezone: true }).notNull().defaultNow(),
  expectedReturnAt: timestamp('expected_return_at', { withTimezone: true }).notNull(),
  renterName: text('renter_name'),
  renterDocument: text('renter_document'),
  renterPhone: text('renter_phone'),
  rentalValue: real('rental_value'),
  notes: text('notes'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  ...timestamps
}, t => ({ codeIdx: uniqueIndex('movements_code_unique').on(t.movementCode) }));

export const movementItems = pgTable('movement_items', {
  id: serial('id').primaryKey(),
  movementId: integer('movement_id').notNull().references(() => movements.id),
  equipmentId: integer('equipment_id').notNull().references(() => equipments.id),
  quantityOut: integer('quantity_out').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  movementId: integer('movement_id').notNull().references(() => movements.id),
  returnedAt: timestamp('returned_at', { withTimezone: true }).notNull().defaultNow(),
  receivedBy: integer('received_by').notNull().references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const returnItems = pgTable('return_items', {
  id: serial('id').primaryKey(),
  returnId: integer('return_id').notNull().references(() => returns.id),
  movementItemId: integer('movement_item_id').notNull().references(() => movementItems.id),
  quantityReturned: integer('quantity_returned').notNull(),
  condition: text('condition', { enum: ['GOOD', 'REGULAR', 'DAMAGED', 'MAINTENANCE'] }).notNull().default('GOOD'),
  missingQuantity: integer('missing_quantity').notNull().default(0),
  damagedQuantity: integer('damaged_quantity').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const maintenances = pgTable('maintenances', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').notNull().references(() => equipments.id),
  quantity: integer('quantity').notNull().default(1),
  status: text('status', { enum: ['OPEN', 'FINISHED', 'CANCELLED'] }).notNull().default('OPEN'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expectedEndAt: timestamp('expected_end_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  provider: text('provider'),
  description: text('description').notNull(),
  cost: real('cost'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  finishedBy: integer('finished_by').references(() => users.id),
  ...timestamps
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  description: text('description').notNull(),
  oldData: text('old_data'),
  newData: text('new_data'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type User = typeof users.$inferSelect;
export type Equipment = typeof equipments.$inferSelect;
export type Movement = typeof movements.$inferSelect;
