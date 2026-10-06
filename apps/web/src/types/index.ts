export type UserRole = 'ADMIN' | 'OPERATOR';
export interface User { id: number; name: string; email: string; role: UserRole }

export interface Category { id: number; name: string; prefix: string; isActive: boolean; createdAt?: string; updatedAt?: string }

export type EquipmentCondition = 'NEW' | 'GOOD' | 'REGULAR' | 'MAINTENANCE' | 'WRITTEN_OFF';
export type EquipmentStatus = 'AVAILABLE' | 'EXTERNAL' | 'EXTERNAL_PARTIAL' | 'RENTAL' | 'RENTAL_PARTIAL' | 'MAINTENANCE' | 'WRITTEN_OFF';

export interface InventorySnapshot { total: number; out: number; maintenance: number; available: number }
export interface EquipmentQuantities { external: number; rental: number }

export interface Equipment {
  id: number;
  internalCode: string;
  name: string;
  model: string | null;
  brand: string | null;
  categoryId: number;
  serialNumber: string | null;
  trackingMode: 'UNIT' | 'BATCH';
  totalQuantity: number;
  condition: EquipmentCondition;
  acquisitionDate: string | null;
  acquisitionValue: number | null;
  photoPath: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy?: number | null;
  category?: Category;
  inventory?: InventorySnapshot;
  quantities?: EquipmentQuantities;
  status?: EquipmentStatus;
  barcodeValue?: string;
}

export interface MovementHistoryItem {
  movementId: number;
  movementCode: string;
  type: 'EXTERNAL' | 'RENTAL';
  status: 'OPEN' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'OVERDUE' | 'CANCELLED';
  responsibleName: string;
  destination: string;
  projectClient: string | null;
  checkoutAt: number | string;
  expectedReturnAt: number | string;
  movementItemId: number;
  quantityOut: number;
  quantityReturned: number;
}

export interface MaintenanceHistoryItem {
  id: number;
  quantity: number;
  status: 'OPEN' | 'FINISHED' | 'CANCELLED';
  startedAt: number | string;
  expectedEndAt: number | string | null;
  finishedAt: number | string | null;
  provider: string | null;
  description: string;
  cost: number | null;
}

export interface DashboardData {
  counters: { totalUnits: number; available: number; external: number; rental: number; maintenance: number; overdue: number; writtenOff: number };
  byCategory: { category: string; total: number }[];
  recentMovements: {
    id: number; movementCode: string; type: 'EXTERNAL' | 'RENTAL'; status: string; responsibleName: string; destination: string;
    checkoutAt: number | string; expectedReturnAt: number | string;
  }[];
}

export type MovementType = 'EXTERNAL' | 'RENTAL';
export type MovementStatus = 'OPEN' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'OVERDUE' | 'CANCELLED';
export type ReturnCondition = 'GOOD' | 'REGULAR' | 'DAMAGED' | 'MAINTENANCE';

export interface Movement {
  id: number;
  movementCode: string;
  type: MovementType;
  status: MovementStatus;
  responsibleName: string;
  responsibleUserId: number | null;
  destination: string;
  projectClient: string | null;
  checkoutAt: number | string;
  expectedReturnAt: number | string;
  renterName: string | null;
  renterDocument: string | null;
  renterPhone: string | null;
  rentalValue: number | null;
  notes: string | null;
  createdBy: number;
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface MovementDetailItem {
  id: number;
  equipmentId: number;
  internalCode: string;
  name: string;
  brand: string | null;
  model: string | null;
  quantityOut: number;
  quantityReturned: number;
}

export interface MovementReturn {
  id: number;
  movementId: number;
  returnedAt: number | string;
  receivedBy: number;
  notes: string | null;
  createdAt: number | string;
}

export interface MovementDetail extends Movement {
  items: MovementDetailItem[];
  returns: MovementReturn[];
}


export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entity: string;
  entityId: number | null;
  description: string;
  oldData: string | null;
  newData: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: number | string;
}

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: number | string;
}

export interface ReportResponse {
  type: 'inventory' | 'out' | 'overdue' | 'history' | 'usage';
  generatedAt: number | string;
  period?: { from: number; to: number };
  data: Record<string, unknown>[];
}
