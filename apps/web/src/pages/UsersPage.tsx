import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Power, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import type { AdminUser, UserRole } from '../types';

export function UsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<UserRole>('OPERATOR'); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const load = () => api<AdminUser[]>('/users').then(setItems).catch(() => setError('Não foi possível carregar os usuários.'));
  useEffect(() => { load(); }, []);
  const reset = () => { setEditing(null); setName(''); setEmail(''); setRole('OPERATOR'); setPassword(''); setError(''); };
  const edit = (u: AdminUser) => { setEditing(u); setName(u.name); setEmail(u.email); setRole(u.role); setPassword(''); setError(''); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name, email, role, ...(password ? { password } : {}) }) });
      else await api('/users', { method: 'POST', body: JSON.stringify({ name, email, role, password }) });
      reset(); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível salvar o usuário.'); }
    finally { setSaving(false); }
  }
  async function toggle(u: AdminUser) {
    try { await api(`/users/${u.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) }); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível alterar o usuário.'); }
  }

  return <div className="space-y-5">
    <div><p className="text-sm text-slate-500">Administradores gerenciam cadastros e configurações; operadores executam a rotina de estoque.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Usuários</h2></div>
    <section className="card p-4 sm:p-5"><form onSubmit={submit} className="grid gap-3 lg:grid-cols-5"><div><label className="label">Nome</label><input className="input" required minLength={2} value={name} onChange={e => setName(e.target.value)} /></div><div><label className="label">E-mail</label><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div><div><label className="label">Perfil</label><select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select></div><div><label className="label">{editing ? 'Nova senha (opcional)' : 'Senha'}</label><input className="input" type="password" required={!editing} minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></div><div className="flex items-end gap-2"><button className="btn-primary" disabled={saving}><Plus className="h-4 w-4" />{editing ? 'Salvar' : 'Criar'}</button>{editing && <button type="button" className="btn-secondary px-3" onClick={reset}><X className="h-4 w-4" /></button>}</div></form>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}</section>
    <section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Usuário</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Criado</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(u => <tr key={u.id}><td className="px-5 py-4"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td><td className="px-4 py-4">{u.role === 'ADMIN' ? 'Administrador' : 'Operador'}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{u.isActive ? 'Ativo' : 'Inativo'}</span></td><td className="px-4 py-4 text-slate-500">{formatDate(u.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className="btn-secondary px-3" onClick={() => edit(u)}><Pencil className="h-4 w-4" />Editar</button><button className="btn-secondary px-3" onClick={() => toggle(u)}><Power className="h-4 w-4" />{u.isActive ? 'Desativar' : 'Ativar'}</button></div></td></tr>)}</tbody></table></div></section>
  </div>;
}
