import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CircleDollarSign, PackageCheck, PackageOpen, Wrench, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import type { DashboardData } from '../types';
import { Loading } from '../components/Loading';

const cards = [
  { key: 'totalUnits', label: 'Total de itens', icon: Boxes, accent: 'text-slate-700 bg-slate-100', danger: false },
  { key: 'available', label: 'Disponíveis', icon: PackageCheck, accent: 'text-emerald-700 bg-emerald-50', danger: false },
  { key: 'external', label: 'Em externa', icon: PackageOpen, accent: 'text-amber-700 bg-amber-50', danger: false },
  { key: 'rental', label: 'Alugados', icon: CircleDollarSign, accent: 'text-blue-700 bg-blue-50', danger: false },
  { key: 'maintenance', label: 'Em manutenção', icon: Wrench, accent: 'text-red-700 bg-red-50', danger: false },
  { key: 'overdue', label: 'Devoluções atrasadas', icon: AlertTriangle, accent: 'text-red-700 bg-red-50', danger: true }
] as const;

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<DashboardData>('/dashboard').then(setData).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar dashboard.')); }, []);

  if (!data && !error) return <Loading label="Carregando dashboard..." />;
  if (error) return <div className="card border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Visão geral do estoque e das movimentações.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Resumo operacional</h2></div><Link to="/equipamentos/novo" className="btn-primary"><Boxes className="h-4 w-4" />Novo equipamento</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map(({ key, label, icon: Icon, accent, danger }) => <div key={key} className={`card p-4 ${danger && data.counters[key] > 0 ? 'border-red-300 ring-2 ring-red-100' : ''}`}><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><div className={`mt-2 text-3xl font-bold ${danger && data.counters[key] > 0 ? 'text-red-600' : 'text-slate-900'}`}>{data.counters[key]}</div></div><div className={`rounded-xl p-2.5 ${accent}`}><Icon className="h-5 w-5" /></div></div></div>)}
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <section className="card p-5 sm:p-6"><div className="mb-5"><h3 className="font-bold">Equipamentos por categoria</h3><p className="text-sm text-slate-500">Quantidade total cadastrada por grupo.</p></div><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byCategory} margin={{ left: -12, right: 8, top: 8, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" angle={-35} textAnchor="end" interval={0} height={78} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="total" name="Quantidade" fill="currentColor" className="text-slate-800" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-5 sm:px-6"><div><h3 className="font-bold">Últimas movimentações</h3><p className="text-sm text-slate-500">Saídas recentes registradas.</p></div><span className="text-xs text-slate-400">{data.recentMovements.length} registros</span></div><div className="divide-y divide-slate-100">{data.recentMovements.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação registrada.</div> : data.recentMovements.map(m => <div key={m.id} className="flex items-center gap-3 px-5 py-4 sm:px-6"><div className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.status === 'OVERDUE' ? 'bg-red-500' : m.type === 'RENTAL' ? 'bg-blue-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-slate-800">{m.movementCode}</span><span className="text-xs text-slate-400">{m.type === 'RENTAL' ? 'Aluguel' : 'Externa'}</span></div><div className="truncate text-sm text-slate-500">{m.responsibleName} · {m.destination}</div></div><div className="text-right"><div className="text-xs font-medium text-slate-600">{formatDate(m.checkoutAt, true)}</div>{m.status === 'OVERDUE' && <div className="mt-1 text-[11px] font-bold uppercase text-red-600">Atrasado</div>}</div></div>)}</div></section>
    </div>
    <Link to="/equipamentos" className="card flex items-center justify-between p-5 transition hover:border-slate-300"><div><div className="font-semibold">Ver todos os equipamentos</div><p className="text-sm text-slate-500">Pesquisar, filtrar e consultar saldos e histórico.</p></div><ArrowUpRight className="h-5 w-5 text-slate-400" /></Link>
  </div>;
}
