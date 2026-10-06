import type { Equipment, EquipmentCondition, EquipmentStatus } from '../types';

export const conditionLabels: Record<EquipmentCondition, string> = {
  NEW: 'Novo', GOOD: 'Bom', REGULAR: 'Regular', MAINTENANCE: 'Em manutenção', WRITTEN_OFF: 'Baixado'
};

export const statusLabels: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Disponível', EXTERNAL: 'Em externa', EXTERNAL_PARTIAL: 'Externa parcial',
  RENTAL: 'Alugado', RENTAL_PARTIAL: 'Aluguel parcial', MAINTENANCE: 'Em manutenção', WRITTEN_OFF: 'Baixado'
};

export const statusClasses: Record<EquipmentStatus, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  EXTERNAL: 'bg-amber-50 text-amber-800 ring-amber-600/20', EXTERNAL_PARTIAL: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  RENTAL: 'bg-blue-50 text-blue-700 ring-blue-600/20', RENTAL_PARTIAL: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  MAINTENANCE: 'bg-red-50 text-red-700 ring-red-600/20', WRITTEN_OFF: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

export function formatDate(value: string | number | Date | null | undefined, withTime = false) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(d);
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}


export function deriveEquipmentStatus(equipment: Equipment): EquipmentStatus {
  if (!equipment.isActive || equipment.condition === 'WRITTEN_OFF') return 'WRITTEN_OFF';
  const maintenance = equipment.inventory?.maintenance ?? (equipment.condition === 'MAINTENANCE' ? equipment.totalQuantity : 0);
  const available = equipment.inventory?.available ?? Math.max(0, equipment.totalQuantity - maintenance);
  const external = equipment.quantities?.external ?? 0;
  const rental = equipment.quantities?.rental ?? 0;
  if (maintenance >= equipment.totalQuantity) return 'MAINTENANCE';
  if (external > 0 && available > 0) return 'EXTERNAL_PARTIAL';
  if (rental > 0 && available > 0) return 'RENTAL_PARTIAL';
  if (external > 0) return 'EXTERNAL';
  if (rental > 0) return 'RENTAL';
  return 'AVAILABLE';
}
