import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { Loading } from '../components/Loading';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import type { MovementDetail, MovementDetailItem, ReturnCondition } from '../types';

type Draft = { quantityReturned: number; condition: ReturnCondition; damagedQuantity: number; missingQuantity: number; notes: string };

export function ReturnPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [movement, setMovement] = useState<MovementDetail | null>(null); const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [pageError, setPageError] = useState(''); const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null); const [notes, setNotes] = useState(''); const [submitting, setSubmitting] = useState(false);

  const load = async () => { try { const m = await api<MovementDetail>(`/movements/${id}`); setMovement(m); const next: Record<number, Draft> = {}; m.items.forEach(i => next[i.id] = { quantityReturned: 0, condition: 'GOOD', damagedQuantity: 0, missingQuantity: 0, notes: '' }); setDrafts(next); } catch (e) { setPageError(e instanceof ApiError ? e.message : 'Erro ao carregar a movimentação.'); } };
  useEffect(() => { void load(); }, [id]);

  const totalPending = useMemo(() => movement?.items.reduce((s, i) => s + pending(i), 0) ?? 0, [movement]);
  const totalReturning = useMemo(() => Object.values(drafts).reduce((s, d) => s + d.quantityReturned, 0), [drafts]);
  const totalMissing = useMemo(() => Object.values(drafts).reduce((s, d) => s + d.missingQuantity, 0), [drafts]);

  const patch = (item: MovementDetailItem, changes: Partial<Draft>) => setDrafts(current => {
    const base = current[item.id] ?? { quantityReturned: 0, condition: 'GOOD' as const, damagedQuantity: 0, missingQuantity: 0, notes: '' };
    let next = { ...base, ...changes };
    const max = pending(item);
    next.quantityReturned = Math.max(0, Math.min(max, next.quantityReturned));
    next.missingQuantity = Math.max(0, Math.min(max - next.quantityReturned, next.missingQuantity));
    next.damagedQuantity = Math.max(0, Math.min(next.quantityReturned, next.damagedQuantity));
    if (next.damagedQuantity > 0 && next.condition === 'GOOD') next.condition = 'DAMAGED';
    return { ...current, [item.id]: next };
  });

  const scan = async (code: string) => {
    if (!movement) return;
    const item = movement.items.find(i => i.internalCode.toUpperCase() === code.toUpperCase());
    if (!item) return setMessage({ kind: 'error', text: `${code} não pertence à saída ${movement.movementCode}.` });
    const max = pending(item); const d = drafts[item.id];
    if (max <= 0) return setMessage({ kind: 'error', text: `${code} já foi totalmente devolvido.` });
    if ((d?.quantityReturned ?? 0) + (d?.missingQuantity ?? 0) >= max) return setMessage({ kind: 'error', text: `${code}: toda a quantidade pendente já está conferida nesta devolução.` });
    patch(item, { quantityReturned: (d?.quantityReturned ?? 0) + 1 });
    setMessage({ kind: 'ok', text: `${code} conferido.` });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!movement) return; setMessage(null);
    const items = movement.items.map(i => ({ item: i, draft: drafts[i.id] })).filter(x => x.draft && (x.draft.quantityReturned > 0 || x.draft.missingQuantity > 0));
    if (items.length === 0) return setMessage({ kind: 'error', text: 'Bipe itens devolvidos ou marque unidades faltantes antes de confirmar.' });
    const summary = `${totalReturning} devolvida(s)${totalMissing ? ` e ${totalMissing} faltante(s)` : ''}`;
    if (!window.confirm(`Confirmar conferência: ${summary}?`)) return;
    setSubmitting(true);
    try {
      await api(`/movements/${movement.id}/returns`, { method: 'POST', body: JSON.stringify({ notes: notes.trim() || null, items: items.map(({ item, draft }) => ({ movementItemId: item.id, quantityReturned: draft.quantityReturned, condition: draft.condition, missingQuantity: draft.missingQuantity, damagedQuantity: draft.damagedQuantity, notes: draft.notes.trim() || null })) }) });
      navigate(`/saidas/${movement.id}`, { replace: true, state: { returnSuccess: true } });
    } catch (err) { setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Não foi possível registrar a devolução.' }); }
    finally { setSubmitting(false); }
  };

  if (!movement && !pageError) return <Loading label="Carregando conferência..." />;
  if (pageError) return <div className="card border-red-200 bg-red-50 p-5 text-sm text-red-700">{pageError}</div>;
  if (!movement) return null;

  return <form onSubmit={submit} className="space-y-5"><div><p className="text-sm text-slate-500">{movement.movementCode} · {movement.destination} · previsto {formatDate(movement.expectedReturnAt, true)}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Conferir devolução</h2></div><BarcodeScanner onScan={scan} disabled={submitting} title="Bipar itens devolvidos" helper="Cada bip confirma 1 unidade. O código precisa pertencer a esta saída." />{message && <div className={`flex items-start gap-2 rounded-xl border p-3.5 text-sm ${message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{message.text}</div>}<div className="grid gap-3 sm:grid-cols-3"><Summary label="Pendente antes" value={totalPending} /><Summary label="Conferido agora" value={totalReturning} good /><Summary label="Marcado faltante" value={totalMissing} danger /></div><section className="space-y-3">{movement.items.map(item => <ReturnItem key={item.id} item={item} draft={drafts[item.id]} onPatch={changes => patch(item, changes)} />)}</section><section className="card p-5"><label className="label">Observações gerais da devolução</label><textarea className="input min-h-24" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ocorrências gerais, conferência, acessórios etc." /></section><div className="sticky bottom-3 z-10 flex justify-end"><button className="btn-primary min-w-56 shadow-lg" disabled={submitting || (totalReturning === 0 && totalMissing === 0)}>{submitting ? 'Registrando...' : <><PackageCheck className="h-4 w-4" />Confirmar devolução</>}</button></div></form>;
}

function pending(i: MovementDetailItem) { return Math.max(0, i.quantityOut - i.quantityReturned); }
function Summary({ label, value, good, danger }: { label: string; value: number; good?: boolean; danger?: boolean }) { return <div className="card p-4"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-1 text-2xl font-bold ${good ? 'text-emerald-600' : danger && value > 0 ? 'text-red-600' : 'text-slate-900'}`}>{value}</div></div>; }
function ReturnItem({ item, draft, onPatch }: { item: MovementDetailItem; draft?: Draft; onPatch: (c: Partial<Draft>) => void }) {
  const d = draft ?? { quantityReturned: 0, condition: 'GOOD' as const, damagedQuantity: 0, missingQuantity: 0, notes: '' }; const max = pending(item); const completeBefore = max === 0;
  return <div className={`card p-4 sm:p-5 ${completeBefore ? 'opacity-60' : ''}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="font-mono text-xs font-bold text-slate-500">{item.internalCode}</div><div className="font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">Saiu {item.quantityOut} · já devolvido {item.quantityReturned} · pendente {max}</div></div>{!completeBefore && <div className="grid gap-3 sm:grid-cols-2 lg:w-[560px] lg:grid-cols-4"><Num label="Devolvendo" value={d.quantityReturned} max={max - d.missingQuantity} onChange={v => onPatch({ quantityReturned: v })} /><label><span className="label">Condição</span><select className="input" value={d.condition} onChange={e => onPatch({ condition: e.target.value as ReturnCondition })}><option value="GOOD">Bom</option><option value="REGULAR">Regular</option><option value="DAMAGED">Com dano</option><option value="MAINTENANCE">Manutenção</option></select></label><Num label="Danificados" value={d.damagedQuantity} max={d.quantityReturned} onChange={v => onPatch({ damagedQuantity: v })} /><Num label="Faltantes" value={d.missingQuantity} max={max - d.quantityReturned} onChange={v => onPatch({ missingQuantity: v })} /></div>}</div>{!completeBefore && <div className="mt-3"><input className="input" value={d.notes} onChange={e => onPatch({ notes: e.target.value })} placeholder="Observação deste item: dano, peça faltante, avaria..." /></div>}</div>;
}
function Num({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) { return <label><span className="label">{label}</span><input type="number" min="0" max={Math.max(0, max)} className="input" value={value} onChange={e => onChange(Number(e.target.value || 0))} /></label>; }
