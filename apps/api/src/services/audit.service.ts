import type { Request } from 'express';
import { db } from '../database/index.js';
import { auditLogs } from '../database/schema.js';

type AuditInput = {
  req?: Request;
  userId?: number;
  action: string;
  entity: string;
  entityId?: number;
  description: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function audit(input: AuditInput) {
  await db.insert(auditLogs).values({
    userId: input.userId ?? input.req?.user?.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    description: input.description,
    oldData: input.oldData === undefined ? null : JSON.stringify(input.oldData),
    newData: input.newData === undefined ? null : JSON.stringify(input.newData),
    ipAddress: input.req?.ip,
    userAgent: input.req?.headers['user-agent']
  });
}
