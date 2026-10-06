import { useState } from 'react';
import { ArrowRight, PackageCheck, ScanBarcode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { StatusBadge } from '../components/StatusBadge';
import { api, ApiError } from '../lib/api';
import { deriveEquipmentStatus } from '../lib/format';
import type { Equipment, EquipmentQuantities, InventorySnapshot } from '../types';

type Lookup = { equipment: Equipment; inventory: InventorySnapshot; quantities: EquipmentQuantities };

export function ScannerPage() {
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const scan = async (code: string) => {
    setLoading(true); setError('');
    try { setResult(await api<Lookup>(`/equipments/barcode/${encodeURIComponent(code)}`)); }
    catch (e) { setResult(null); setError(e instanceof ApiError ? e.message : 'Não foi possível localizar o equipamento.'); }
    finally { setLoading(false); }
  };

  const equipment = result ? { ...result.equipment, inventory: result.inventory, quantities: result.quantities } : null;
  const status = equipment ? deriveEquipmentStatus(equipment) : null;
  const inventory = result?.inventory ?? null;

  return <div className="mx-auto max-w-4xl space-y-5">
    <div><p className="text-sm text-slate-500">Localização rápida por código de barras.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Scanner</h2></div>
    <BarcodeScanner onScan={scan} disabled={loading} title="Buscar por código de barras" helper="Bipe com leitor USB ou ative a câmera. Code 128 é reconhecido automaticamente." />
    {error && <div className="card border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
    {loading && <div className="card p-5 text-sm text-slate-500">Consultando equipamento...</div>}
    {equipment && status && inventory && <section className="card overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"><ScanBarcode className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold text-slate-500">{equipment.internalCode}</span><StatusBadge status={status} /></div><h3 className="mt-1 text-xl font-bold text-slate-900">{equipment.name}</h3><p className="text-sm text-slate-500">{[equipment.brand, equipment.model].filter(Boolean).join(' · ') || 'Sem marca/modelo informado'}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-px border-y border-slate-200 bg-slate-200 sm:grid-cols-4"><Stat label="Total" value={equipment.totalQuantity} /><Stat label="Disponível" value={inventory.available} good /><Stat label="Fora" value={inventory.out} /><Stat label="Manutenção" value={inventory.maintenance} /></div>
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-end"><Link to={`/equipamentos/${equipment.id}`} className="btn-secondary">Ver cadastro <ArrowRight className="h-4 w-4" /></Link>{inventory.available > 0 && <Link to={`/saidas/nova?code=${encodeURIComponent(equipment.internalCode)}`} className="btn-primary"><PackageCheck className="h-4 w-4" />Adicionar a uma saída</Link>}</div>
    </section>}
  </div>;
}

function Stat({ label, value, good = false }: { label: string; value: number; good?: boolean }) { return <div className="bg-white p-4"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-1 text-2xl font-bold ${good ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div></div>; }
