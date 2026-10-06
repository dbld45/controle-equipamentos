import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { StatusBadge } from '../components/StatusBadge';
import { api, ApiError, assetUrl } from '../lib/api';
import { conditionLabels } from '../lib/format';
import type { Category, Equipment, EquipmentCondition, EquipmentStatus } from '../types';

interface ListResponse { items: Equipment[]; pagination: { page: number; pageSize: number; total: number; pages: number } }

export function EquipmentListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('internalCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => { api<Category[]>('/categories').then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortOrder });
    if (search) p.set('q', search);
    if (categoryId) p.set('categoryId', categoryId);
    if (condition) p.set('condition', condition);
    if (status) p.set('status', status);
    return p.toString();
  }, [page, search, categoryId, condition, status, sortBy, sortOrder]);

  useEffect(() => {
    setLoading(true); setError('');
    api<ListResponse>(`/equipments?${params}`).then(setData).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar equipamentos.')).finally(() => setLoading(false));
  }, [params]);

  const clearFilters = () => { setQuery(''); setCategoryId(''); setCondition(''); setStatus(''); setSortBy('internalCode'); setSortOrder('asc'); setPage(1); };
  const activeFilters = [categoryId, condition, status].filter(Boolean).length;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Consulte o patrimônio e o saldo atual em estoque.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Equipamentos</h2></div><Link to="/equipamentos/novo" className="btn-primary"><Plus className="h-4 w-4" />Cadastrar equipamento</Link></div>

    <section className="card p-4 sm:p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(150px,.7fr))]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-10" placeholder="Código, nome, marca ou modelo..." value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select className="input" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}><option value="">Todas as categorias</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Todos os status</option><option value="AVAILABLE">Disponível</option><option value="EXTERNAL">Em externa</option><option value="RENTAL">Alugado</option><option value="MAINTENANCE">Em manutenção</option><option value="WRITTEN_OFF">Baixado</option></select>
        <select className="input" value={condition} onChange={e => { setCondition(e.target.value); setPage(1); }}><option value="">Todos os estados</option>{Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="flex gap-2"><select className="input" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}><option value="internalCode">Ordenar: código</option><option value="name">Nome</option><option value="category">Categoria</option><option value="status">Status</option><option value="available">Disponibilidade</option><option value="totalQuantity">Quantidade</option></select><button type="button" className="btn-secondary px-3" title="Inverter ordenação" onClick={() => setSortOrder(v => v === 'asc' ? 'desc' : 'asc')}><SlidersHorizontal className={`h-4 w-4 transition ${sortOrder === 'desc' ? 'rotate-180' : ''}`} /></button></div>
      </div>
      {activeFilters > 0 && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" />{activeFilters} filtro(s) ativo(s)<button onClick={clearFilters} className="font-semibold text-slate-800 underline underline-offset-2">Limpar</button></div>}
    </section>

    <section className="card overflow-hidden">
      {loading ? <Loading label="Buscando equipamentos..." /> : error ? <div className="p-5 text-sm text-red-700">{error}</div> : !data || data.items.length === 0 ? <EmptyState title="Nenhum equipamento encontrado" description="Altere os filtros ou cadastre um novo equipamento." /> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3.5 font-semibold">Equipamento</th><th className="px-4 py-3.5 font-semibold">Categoria</th><th className="px-4 py-3.5 font-semibold">Status</th><th className="px-4 py-3.5 font-semibold">Disponível</th><th className="px-4 py-3.5 font-semibold">Conservação</th><th className="px-5 py-3.5 text-right font-semibold">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.map(item => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3">{item.photoPath ? <img src={assetUrl(item.photoPath)!} alt="" className="h-11 w-11 rounded-xl border border-slate-200 object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">AV</div>}<div><Link to={`/equipamentos/${item.id}`} className="font-semibold text-slate-900 hover:underline">{item.internalCode}</Link><div className="mt-0.5 text-slate-600">{item.name}{item.model ? ` · ${item.model}` : ''}</div><div className="text-xs text-slate-400">{item.brand || 'Sem marca'}</div></div></div></td><td className="px-4 py-4 text-slate-600">{item.category?.name}</td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4"><span className="font-semibold text-slate-800">{item.inventory?.available ?? 0}</span><span className="text-slate-400"> / {item.totalQuantity}</span></td><td className="px-4 py-4 text-slate-600">{conditionLabels[item.condition]}</td><td className="px-5 py-4 text-right"><Link to={`/equipamentos/${item.id}`} className="font-semibold text-slate-700 hover:text-slate-950">Detalhes</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 md:hidden">{data.items.map(item => <Link key={item.id} to={`/equipamentos/${item.id}`} className="block p-4 hover:bg-slate-50"><div className="flex gap-3">{item.photoPath ? <img src={assetUrl(item.photoPath)!} alt="" className="h-14 w-14 rounded-xl border border-slate-200 object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">AV</div>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><div className="font-bold text-slate-900">{item.internalCode}</div><div className="truncate text-sm text-slate-600">{item.name}</div></div><StatusBadge status={item.status} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{item.category?.name}</span><span><strong className="text-slate-800">{item.inventory?.available ?? 0}</strong> / {item.totalQuantity} disponível(is)</span></div></div></div></Link>)}</div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="text-sm text-slate-500">{data.pagination.total} equipamento(s) · Página {data.pagination.page} de {data.pagination.pages}</div><div className="flex gap-2"><button className="btn-secondary px-3" disabled={page <= 1} onClick={() => setPage(v => Math.max(1, v - 1))}><ChevronLeft className="h-4 w-4" />Anterior</button><button className="btn-secondary px-3" disabled={page >= data.pagination.pages} onClick={() => setPage(v => v + 1)}>Próxima<ChevronRight className="h-4 w-4" /></button></div></div>
      </>}
    </section>
  </div>;
}
