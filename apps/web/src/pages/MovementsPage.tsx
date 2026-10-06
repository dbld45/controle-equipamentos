import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { api, ApiError } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/format';
import type { Movement } from '../types';

export function MovementsPage() {
  const [rows, setRows] = useState<Movement[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<Movement[]>('/movements').then(setRows).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar saídas.')); }, []);
  if (!rows && !error) return <Loading label="Carregando saídas..." />;
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Externas e aluguéis, com retorno previsto e situação atual.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Saídas</h2></div><Link to="/saidas/nova" className="btn-primary"><Plus className="h-4 w-4" />Nova saída</Link></div>{error && <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="card overflow-hidden">{rows?.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nenhuma saída registrada.</div> : <div className="divide-y divide-slate-100">{rows?.map(m => <Link to={`/saidas/${m.id}`} key={m.id} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:px-5"><div className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.status === 'OVERDUE' ? 'bg-red-500' : m.type === 'RENTAL' ? 'bg-blue-500' : m.status === 'RETURNED' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{m.movementCode}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{m.type === 'RENTAL' ? 'Aluguel' : 'Externa'}</span>{m.status === 'OVERDUE' && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700"><AlertTriangle className="h-3 w-3" />Atrasado</span>}</div><div className="mt-0.5 truncate text-sm text-slate-600">{m.responsibleName} · {m.destination}</div><div className="mt-1 text-xs text-slate-400">Saída {formatDate(m.checkoutAt, true)} · retorno {formatDate(m.expectedReturnAt, true)}{m.type === 'RENTAL' && m.rentalValue != null ? ` · ${formatCurrency(m.rentalValue)}` : ''}</div></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></Link>)}</div>}</section></div>;
}
