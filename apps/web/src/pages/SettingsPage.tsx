import { useEffect, useState } from 'react';
import { DatabaseBackup, Download, FileJson, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, ApiError, downloadApiFile } from '../lib/api';
import { formatDate } from '../lib/format';
import type { AuditLog, BackupFile } from '../types';

function bytes(v: number) { if (v < 1024) return `${v} B`; if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`; return `${(v / 1024 / 1024).toFixed(1)} MB`; }

export function SettingsPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    try { const [b, l] = await Promise.all([api<BackupFile[]>('/backups'), api<AuditLog[]>('/audit?limit=80')]); setBackups(b); setLogs(l); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível carregar as configurações.'); }
  };
  useEffect(() => { load(); }, []);

  async function createBackup(download = false) {
    setBusy(true); setError('');
    try {
      if (download) await downloadApiFile('/backups/database', `controle-av-cloud-backup-${Date.now()}.json`);
      else await api('/backups', { method: 'POST' });
      await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível gerar o backup.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div><p className="text-sm text-slate-500">Backup, exportação dos dados e trilha de auditoria do sistema.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Configurações e auditoria</h2></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5"><DatabaseBackup className="h-6 w-6 text-slate-700" /><h3 className="mt-3 font-bold">Backup em nuvem</h3><p className="mt-1 text-sm text-slate-500">Cria um snapshot JSON persistente dos dados no PostgreSQL para arquivamento ou recuperação manual.</p><div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" disabled={busy} onClick={() => createBackup(false)}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Criar backup</button><button className="btn-secondary" disabled={busy} onClick={() => createBackup(true)}><Download className="h-4 w-4" />Baixar agora</button></div></div>
      <div className="card p-5"><FileJson className="h-6 w-6 text-slate-700" /><h3 className="mt-3 font-bold">Exportação completa</h3><p className="mt-1 text-sm text-slate-500">Exporta equipamentos, movimentações, devoluções, manutenção e auditoria em JSON.</p><button className="btn-secondary mt-4" onClick={() => downloadApiFile('/backups/export-json', `controle-av-${Date.now()}.json`)}><Download className="h-4 w-4" />Exportar JSON</button></div>
      <div className="card p-5"><ShieldCheck className="h-6 w-6 text-slate-700" /><h3 className="mt-3 font-bold">Segurança</h3><p className="mt-1 text-sm text-slate-500">JWT, senhas bcrypt, permissões por perfil e registro de ações administrativas e operacionais.</p><div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Auditoria habilitada</div></div>
    </section>
    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-4 sm:p-5"><h3 className="font-bold">Backups disponíveis</h3></div>{backups.length === 0 ? <div className="p-6 text-sm text-slate-500">Nenhum backup criado ainda.</div> : <div className="divide-y divide-slate-100">{backups.slice(0, 15).map(b => <div key={b.filename} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-mono text-xs font-semibold text-slate-700">{b.filename}</div><div className="mt-1 text-xs text-slate-400">{formatDate(b.createdAt, true)} · {bytes(b.size)}</div></div><button className="btn-secondary" onClick={() => downloadApiFile(`/backups/download/${encodeURIComponent(b.filename)}`, b.filename)}><Download className="h-4 w-4" />Baixar</button></div>)}</div>}</section>
    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-4 sm:p-5"><h3 className="font-bold">Trilha de auditoria</h3><p className="mt-1 text-xs text-slate-500">Últimas {logs.length} ações registradas.</p></div><div className="divide-y divide-slate-100">{logs.map(log => <div key={log.id} className="p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">{log.action}</span><p className="mt-2 text-sm text-slate-700">{log.description}</p></div><div className="text-xs text-slate-400">{formatDate(log.createdAt, true)}</div></div></div>)}</div></section>
  </div>;
}
