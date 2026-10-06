import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ArrowDownToLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Movement } from '../types';

export function ReturnsPage() {
  const [rows, setRows] = useState<Movement[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { api<Movement[]>('/movements/active').then(setRows).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar devoluções pendentes.')); }, []);
  if (!rows && !error) return <Loading label="Carregando pendências..." />;
  return <div className="space-y-5"><div><p className="text-sm text-slate-500">Selecione uma saída e confira os itens devolvidos por código de barras.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Devoluções</h2></div>{error && <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="card overflow-hidden">{rows?.length === 0 ? <div className="p-10 text-center"><ArrowDownToLine className="mx-auto h-9 w-9 text-emerald-500" /><div className="mt-3 font-semibold">Tudo em dia</div><p className="mt-1 text-sm text-slate-500">Não há saídas aguardando devolução.</p></div> : <div className="divide-y divide-slate-100">{rows?.map(m => <Link to={`/devolucoes/${m.id}`} key={m.id} className="flex items-center gap-3 p-4 transition hover:bg-slate-50 sm:px-5"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.status === 'OVERDUE' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{m.status === 'OVERDUE' ? <AlertTriangle className="h-5 w-5" /> : <ArrowDownToLine className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{m.movementCode}</span><span className="text-xs text-slate-400">{m.type === 'RENTAL' ? 'Aluguel' : 'Externa'}</span></div><div className="truncate text-sm text-slate-600">{m.responsibleName} · {m.destination}</div><div className={`mt-1 text-xs ${m.status === 'OVERDUE' ? 'font-semibold text-red-600' : 'text-slate-400'}`}>Retorno previsto: {formatDate(m.expectedReturnAt, true)}</div></div><ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div>}</section></div>;
}
