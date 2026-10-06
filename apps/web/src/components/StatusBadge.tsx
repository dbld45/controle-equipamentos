import type { EquipmentStatus } from '../types';
import { statusClasses, statusLabels } from '../lib/format';

export function StatusBadge({ status = 'AVAILABLE' }: { status?: EquipmentStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}
