import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Category } from '../types';

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api<Category[]>('/categories').then(setItems).catch(() => setError('Não foi possível carregar as categorias.'));
  useEffect(() => { load(); }, []);
  const reset = () => { setEditing(null); setName(''); setPrefix(''); setError(''); };
  const edit = (c: Category) => { setEditing(c); setName(c.name); setPrefix(c.prefix); setError(''); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api(`/categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name, prefix }) });
      else await api('/categories', { method: 'POST', body: JSON.stringify({ name, prefix }) });
      reset(); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível salvar a categoria.'); }
    finally { setSaving(false); }
  }

  async function toggle(c: Category) {
    try { await api(`/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) }); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível alterar a categoria.'); }
  }
  async function remove(c: Category) {
    if (!window.confirm(`Excluir a categoria "${c.name}"? Essa ação só é permitida se não houver equipamentos vinculados.`)) return;
    try { await api(`/categories/${c.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível excluir a categoria.'); }
  }

  return <div className="space-y-5">
    <div><p className="text-sm text-slate-500">Defina os tipos de equipamento e o prefixo usado na geração dos códigos internos.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Categorias</h2></div>
    <section className="card p-4 sm:p-5"><form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><div><label className="label">Nome da categoria</label><input className="input" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Gravador" /></div><div><label className="label">Prefixo</label><input className="input uppercase" required minLength={2} maxLength={5} value={prefix} onChange={e => setPrefix(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder="GRV" /></div><div className="flex items-end gap-2"><button className="btn-primary" disabled={saving}><Plus className="h-4 w-4" />{editing ? 'Salvar' : 'Adicionar'}</button>{editing && <button type="button" className="btn-secondary px-3" onClick={reset}><X className="h-4 w-4" /></button>}</div></form>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}</section>
    <section className="card overflow-hidden"><div className="divide-y divide-slate-100">{items.map(c => <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-semibold">{c.name}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.isActive ? 'Ativa' : 'Inativa'}</span></div><div className="mt-1 font-mono text-xs text-slate-500">Prefixo: {c.prefix}-0001</div></div><div className="flex gap-2"><button className="btn-secondary px-3" onClick={() => edit(c)}><Pencil className="h-4 w-4" />Editar</button><button className="btn-secondary px-3" onClick={() => toggle(c)}><Power className="h-4 w-4" />{c.isActive ? 'Desativar' : 'Ativar'}</button><button className="btn-secondary px-3 text-red-700" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></button></div></div>)}</div></section>
  </div>;
}
