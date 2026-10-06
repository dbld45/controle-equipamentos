import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Edit3, Hash, PackageCheck, PackageOpen, PlusCircle, ReceiptText, Tag, Trash2, Wrench, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Barcode } from '../components/Barcode';
import { Loading } from '../components/Loading';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError, assetUrl } from '../lib/api';
import { conditionLabels, deriveEquipmentStatus, formatCurrency, formatDate } from '../lib/format';
import type { Equipment, MaintenanceHistoryItem, MovementHistoryItem } from '../types';

interface HistoryResponse { movementHistory: MovementHistoryItem[]; maintenanceHistory: MaintenanceHistoryItem[] }
const movementStatus: Record<string, string> = { OPEN: 'Em aberto', PARTIALLY_RETURNED: 'Devolução parcial', RETURNED: 'Devolvido', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado' };

export function EquipmentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenanceQty, setMaintenanceQty] = useState(1);
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceProvider, setMaintenanceProvider] = useState('');
  const [maintenanceExpected, setMaintenanceExpected] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [e, h] = await Promise.all([api<Equipment>(`/equipments/${id}`), api<HistoryResponse>(`/equipments/${id}/history`)]);
      setEquipment(e); setHistory(h);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o equipamento.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  const status = useMemo(() => equipment ? deriveEquipmentStatus(equipment) : 'AVAILABLE', [equipment]);

  async function writeOff() {
    if (!equipment || !window.confirm(`Baixar o equipamento ${equipment.internalCode}? Ele ficará indisponível, mas o histórico será preservado.`)) return;
    setActioning(true); setError('');
    try { await api(`/equipments/${equipment.id}/write-off`, { method: 'POST' }); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível baixar o equipamento.'); }
    finally { setActioning(false); }
  }

  async function remove() {
    if (!equipment || !window.confirm(`Excluir definitivamente ${equipment.internalCode}? Esta ação só é permitida se não existir histórico.`)) return;
    setActioning(true); setError('');
    try { await api(`/equipments/${equipment.id}`, { method: 'DELETE' }); navigate('/equipamentos', { replace: true }); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o equipamento.'); setActioning(false); }
  }

  async function openMaintenance() {
    if (!equipment || !maintenanceDescription.trim()) return;
    setActioning(true); setError('');
    try {
      await api('/maintenances', { method: 'POST', body: JSON.stringify({
        equipmentId: equipment.id,
        quantity: maintenanceQty,
        description: maintenanceDescription.trim(),
        provider: maintenanceProvider.trim() || null,
        expectedEndAt: maintenanceExpected || null,
        cost: maintenanceCost ? Number(maintenanceCost) : null
      }) });
      setShowMaintenance(false); setMaintenanceDescription(''); setMaintenanceProvider(''); setMaintenanceExpected(''); setMaintenanceCost(''); setMaintenanceQty(1);
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a manutenção.'); }
    finally { setActioning(false); }
  }

  async function finishMaintenance(maintenanceId: number) {
    if (!window.confirm('Finalizar esta manutenção e devolver a quantidade ao saldo disponível?')) return;
    setActioning(true); setError('');
    try { await api(`/maintenances/${maintenanceId}/finish`, { method: 'POST' }); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível finalizar a manutenção.'); }
    finally { setActioning(false); }
  }

  if (loading) return <Loading label="Carregando equipamento..." />;
  if (!equipment) return <div className="card p-5 text-sm text-red-700">{error || 'Equipamento não encontrado.'}</div>;

  const available = equipment.inventory?.available ?? 0;
  const external = equipment.quantities?.external ?? 0;
  const rental = equipment.quantities?.rental ?? 0;
  const maintenance = equipment.inventory?.maintenance ?? 0;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><Link to="/equipamentos" className="btn-secondary mt-0.5 px-3"><ArrowLeft className="h-4 w-4" /></Link><div><div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold text-slate-500">{equipment.internalCode}</span><StatusBadge status={status} /></div><h2 className="text-2xl font-bold tracking-tight">{equipment.name}</h2><p className="mt-1 text-sm text-slate-500">{[equipment.brand, equipment.model].filter(Boolean).join(' · ') || 'Sem marca/modelo informado'}</p></div></div><div className="flex flex-wrap gap-2"><Link to={`/equipamentos/${equipment.id}/editar`} className="btn-secondary"><Edit3 className="h-4 w-4" />Editar</Link>{equipment.isActive && (equipment.inventory?.available ?? 0) > 0 && <button disabled={actioning} onClick={() => setShowMaintenance(v => !v)} className="btn-secondary"><PlusCircle className="h-4 w-4" />Manutenção</button>}{user?.role === 'ADMIN' && equipment.isActive && <button disabled={actioning} onClick={writeOff} className="btn-danger"><XCircle className="h-4 w-4" />Baixar</button>}{user?.role === 'ADMIN' && (history?.movementHistory.length ?? 0) === 0 && <button disabled={actioning} onClick={remove} className="btn-secondary text-red-600"><Trash2 className="h-4 w-4" />Excluir</button>}</div></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {showMaintenance && <section className="card p-4 sm:p-5"><h3 className="font-bold">Abrir manutenção</h3><p className="mt-1 text-sm text-slate-500">A quantidade informada ficará indisponível até a manutenção ser finalizada.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div><label className="label">Quantidade</label><input className="input" type="number" min={1} max={equipment.inventory?.available ?? 1} value={maintenanceQty} onChange={e => setMaintenanceQty(Math.max(1, Number(e.target.value) || 1))} /></div><div className="lg:col-span-2"><label className="label">Descrição</label><input className="input" value={maintenanceDescription} onChange={e => setMaintenanceDescription(e.target.value)} placeholder="Ex.: revisão do conector SDI" /></div><div><label className="label">Prestador</label><input className="input" value={maintenanceProvider} onChange={e => setMaintenanceProvider(e.target.value)} /></div><div><label className="label">Previsão</label><input className="input" type="date" value={maintenanceExpected} onChange={e => setMaintenanceExpected(e.target.value)} /></div><div><label className="label">Custo estimado</label><input className="input" type="number" min="0" step="0.01" value={maintenanceCost} onChange={e => setMaintenanceCost(e.target.value)} /></div></div><div className="mt-4 flex gap-2"><button className="btn-primary" disabled={actioning || !maintenanceDescription.trim()} onClick={openMaintenance}><Wrench className="h-4 w-4" />Registrar manutenção</button><button className="btn-secondary" onClick={() => setShowMaintenance(false)}>Cancelar</button></div></section>}

    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="card overflow-hidden"><div className="grid gap-0 md:grid-cols-[260px_1fr]"> <div className="min-h-64 bg-slate-100">{equipment.photoPath ? <img src={assetUrl(equipment.photoPath)!} alt={equipment.name} className="h-full min-h-64 w-full object-cover" /> : <div className="grid h-full min-h-64 place-items-center text-slate-400"><PackageOpen className="h-14 w-14" /></div>}</div><div className="p-5 sm:p-6"><h3 className="font-bold">Dados do patrimônio</h3><dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2"><Info icon={Tag} label="Categoria" value={equipment.category?.name || '—'} /><Info icon={Hash} label="Número de série" value={equipment.serialNumber || '—'} /><Info icon={PackageCheck} label="Controle" value={equipment.trackingMode === 'UNIT' ? 'Item unitário' : `Lote com ${equipment.totalQuantity} unidades`} /><Info icon={Wrench} label="Conservação" value={conditionLabels[equipment.condition]} /><Info icon={CalendarDays} label="Data de aquisição" value={formatDate(equipment.acquisitionDate)} /><Info icon={ReceiptText} label="Valor de aquisição" value={formatCurrency(equipment.acquisitionValue)} /></dl>{equipment.notes && <div className="mt-6 rounded-xl bg-slate-50 p-4"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Observações</div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{equipment.notes}</p></div>}</div></div></section>

      <div className="space-y-5"><section className="card p-5 sm:p-6"><h3 className="font-bold">Saldo atual</h3><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Disponível" value={available} className="bg-emerald-50 text-emerald-800" /><Metric label="Em externa" value={external} className="bg-amber-50 text-amber-800" /><Metric label="Alugado" value={rental} className="bg-blue-50 text-blue-800" /><Metric label="Manutenção" value={maintenance} className="bg-red-50 text-red-800" /></div><div className="mt-4 text-xs text-slate-400">Quantidade total cadastrada: {equipment.totalQuantity}</div></section>
        <section className="card p-5 sm:p-6"><div className="mb-4"><h3 className="font-bold">Código de barras</h3><p className="text-sm text-slate-500">Code 128 vinculado ao código interno.</p></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"><Barcode value={equipment.barcodeValue || equipment.internalCode} /></div></section></div>
    </div>

    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-5 sm:px-6"><h3 className="font-bold">Histórico de movimentações</h3><p className="text-sm text-slate-500">Saídas e devoluções relacionadas a este equipamento.</p></div>{!history?.movementHistory.length ? <div className="p-8 text-center text-sm text-slate-500">Este equipamento ainda não possui movimentações.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3.5">Movimentação</th><th className="px-4 py-3.5">Tipo</th><th className="px-4 py-3.5">Responsável / destino</th><th className="px-4 py-3.5">Saída</th><th className="px-4 py-3.5">Quantidade</th><th className="px-5 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{history.movementHistory.map((m, i) => <tr key={`${m.movementItemId}-${i}`}><td className="px-5 py-4 font-semibold">{m.movementCode}</td><td className="px-4 py-4">{m.type === 'RENTAL' ? 'Aluguel' : 'Externa'}</td><td className="px-4 py-4"><div>{m.responsibleName}</div><div className="text-xs text-slate-400">{m.destination}</div></td><td className="px-4 py-4">{formatDate(m.checkoutAt, true)}<div className="text-xs text-slate-400">Prev.: {formatDate(m.expectedReturnAt, true)}</div></td><td className="px-4 py-4"><strong>{m.quantityOut - m.quantityReturned}</strong> pendente(s)<div className="text-xs text-slate-400">{m.quantityReturned}/{m.quantityOut} devolvida(s)</div></td><td className={`px-5 py-4 font-semibold ${m.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-600'}`}>{movementStatus[m.status] || m.status}</td></tr>)}</tbody></table></div>}</section>

    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-5 sm:px-6"><h3 className="font-bold">Histórico de manutenção</h3><p className="text-sm text-slate-500">Intervenções técnicas registradas.</p></div>{!history?.maintenanceHistory.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhuma manutenção registrada.</div> : <div className="divide-y divide-slate-100">{history.maintenanceHistory.map(m => <div key={m.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:px-6"><div><div className="font-semibold">{m.description}</div><div className="mt-1 text-sm text-slate-500">{m.provider || 'Prestador não informado'} · {m.quantity} unidade(s)</div></div><div className="text-left text-sm sm:text-right"><div className="font-semibold">{m.status === 'OPEN' ? 'Em andamento' : m.status === 'FINISHED' ? 'Finalizada' : 'Cancelada'}</div><div className="text-xs text-slate-400">Início: {formatDate(m.startedAt, true)}</div>{m.status === 'OPEN' && <button disabled={actioning} onClick={() => finishMaintenance(m.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"><CheckCircle2 className="h-3.5 w-3.5" />Finalizar manutenção</button>}</div></div>)}</div>}</section>
  </div>;
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) { return <div className="flex gap-3"><div className="mt-0.5 rounded-lg bg-slate-100 p-2"><Icon className="h-4 w-4 text-slate-500" /></div><div><dt className="text-xs font-medium text-slate-400">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{value}</dd></div></div>; }
function Metric({ label, value, className }: { label: string; value: number; className: string }) { return <div className={`rounded-xl p-4 ${className}`}><div className="text-xs font-semibold">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>; }
