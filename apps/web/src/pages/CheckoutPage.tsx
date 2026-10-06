import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Minus, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import type { Equipment, EquipmentQuantities, InventorySnapshot } from '../types';

type Lookup = { equipment: Equipment; inventory: InventorySnapshot; quantities: EquipmentQuantities };
type KitItem = { equipment: Equipment; available: number; quantity: number };
type CheckoutResponse = { id: number; movementCode: string };

function defaultReturnDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [type, setType] = useState<'EXTERNAL' | 'RENTAL'>('EXTERNAL');
  const [responsibleName, setResponsibleName] = useState(user?.name ?? '');
  const [destination, setDestination] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [expectedReturnAt, setExpectedReturnAt] = useState(defaultReturnDate());
  const [renterName, setRenterName] = useState('');
  const [renterDocument, setRenterDocument] = useState('');
  const [renterPhone, setRenterPhone] = useState('');
  const [rentalValue, setRentalValue] = useState('');
  const [notes, setNotes] = useState('');
  const [kit, setKit] = useState<KitItem[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalUnits = useMemo(() => kit.reduce((sum, x) => sum + x.quantity, 0), [kit]);

  const scan = async (code: string) => {
    setMessage(null);
    try {
      const found = await api<Lookup>(`/equipments/barcode/${encodeURIComponent(code)}`);
      if (!found.equipment.isActive || found.equipment.condition === 'WRITTEN_OFF') throw new Error(`${found.equipment.internalCode} está baixado/indisponível.`);
      if (found.equipment.condition === 'MAINTENANCE') throw new Error(`${found.equipment.internalCode} está marcado como em manutenção.`);
      if (found.inventory.available <= 0) throw new Error(`${found.equipment.internalCode} não possui unidades disponíveis.`);
      setKit(current => {
        const existing = current.find(x => x.equipment.id === found.equipment.id);
        if (!existing) return [...current, { equipment: found.equipment, available: found.inventory.available, quantity: 1 }];
        if (existing.quantity >= found.inventory.available) { setMessage({ kind: 'error', text: `${found.equipment.internalCode}: todas as ${found.inventory.available} unidade(s) disponíveis já estão no kit.` }); return current; }
        return current.map(x => x.equipment.id === found.equipment.id ? { ...x, quantity: x.quantity + 1, available: found.inventory.available } : x);
      });
      setMessage({ kind: 'ok', text: `${found.equipment.internalCode} adicionado ao kit.` });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível adicionar o item.' }); }
  };

  useEffect(() => {
    const code = params.get('code');
    if (code) void scan(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeQty = (equipmentId: number, delta: number) => setKit(current => current.map(x => x.equipment.id === equipmentId ? { ...x, quantity: Math.max(1, Math.min(x.available, x.quantity + delta)) } : x));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMessage(null);
    if (kit.length === 0) return setMessage({ kind: 'error', text: 'Bipe pelo menos um equipamento para montar o kit.' });
    if (!responsibleName.trim() || !destination.trim() || !expectedReturnAt) return setMessage({ kind: 'error', text: 'Preencha responsável, destino e previsão de retorno.' });
    if (type === 'RENTAL' && !renterName.trim()) return setMessage({ kind: 'error', text: 'Informe o locatário para o aluguel.' });
    if (!window.confirm(`Confirmar ${type === 'RENTAL' ? 'aluguel' : 'saída externa'} com ${totalUnits} unidade(s)?`)) return;
    setSubmitting(true);
    try {
      const result = await api<CheckoutResponse>('/movements', { method: 'POST', body: JSON.stringify({
        type, responsibleName: responsibleName.trim(), destination: destination.trim(), projectClient: projectClient.trim() || null,
        expectedReturnAt: new Date(expectedReturnAt).toISOString(), renterName: type === 'RENTAL' ? renterName.trim() : null,
        renterDocument: type === 'RENTAL' ? renterDocument.trim() || null : null, renterPhone: type === 'RENTAL' ? renterPhone.trim() || null : null,
        rentalValue: type === 'RENTAL' && rentalValue !== '' ? Number(rentalValue) : null, notes: notes.trim() || null,
        items: kit.map(x => ({ equipmentId: x.equipment.id, quantity: x.quantity }))
      }) });
      navigate(`/saidas/${result.id}`, { replace: true, state: { created: result.movementCode } });
    } catch (err) { setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Não foi possível registrar a saída.' }); }
    finally { setSubmitting(false); }
  };

  return <form onSubmit={submit} className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Monte o kit bipando os itens e confirme os dados da retirada.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Nova saída</h2></div><div className="inline-flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setType('EXTERNAL')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${type === 'EXTERNAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Externa</button><button type="button" onClick={() => setType('RENTAL')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${type === 'RENTAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Aluguel</button></div></div>
    <BarcodeScanner onScan={scan} disabled={submitting} title="Montar kit de saída" helper="Cada bip adiciona 1 unidade. Para itens em lote, bipe novamente ou ajuste a quantidade." />
    {message && <div className={`flex items-start gap-2 rounded-xl border p-3.5 text-sm ${message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{message.text}</div>}
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:px-5"><div><h3 className="font-bold">Kit de saída</h3><p className="text-sm text-slate-500">{kit.length} equipamento(s) · {totalUnits} unidade(s)</p></div><PackagePlus className="h-5 w-5 text-slate-400" /></div>
      {kit.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhum item bipado ainda.</div> : <div className="divide-y divide-slate-100">{kit.map(item => <div key={item.equipment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5"><div className="min-w-0 flex-1"><div className="font-mono text-xs font-bold text-slate-500">{item.equipment.internalCode}</div><div className="truncate font-semibold text-slate-900">{item.equipment.name}</div><div className="text-xs text-slate-500">Disponível no estoque: {item.available}</div></div><div className="flex items-center justify-between gap-2 sm:justify-end"><div className="flex items-center rounded-xl border border-slate-300"><button type="button" className="p-2.5 text-slate-500 hover:bg-slate-50" onClick={() => changeQty(item.equipment.id, -1)}><Minus className="h-4 w-4" /></button><span className="min-w-10 text-center text-sm font-bold">{item.quantity}</span><button type="button" className="p-2.5 text-slate-500 hover:bg-slate-50" onClick={() => changeQty(item.equipment.id, 1)}><Plus className="h-4 w-4" /></button></div><button type="button" title="Remover" onClick={() => setKit(current => current.filter(x => x.equipment.id !== item.equipment.id))} className="rounded-xl p-2.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}
    </section>
    <section className="card p-5 sm:p-6"><h3 className="mb-4 font-bold">Dados da retirada</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Responsável pela retirada"><input className="input" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} required /></Field><Field label="Destino"><input className="input" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Local da gravação/evento" required /></Field><Field label="Projeto / cliente"><input className="input" value={projectClient} onChange={e => setProjectClient(e.target.value)} /></Field><Field label="Previsão de retorno"><input className="input" type="datetime-local" value={expectedReturnAt} onChange={e => setExpectedReturnAt(e.target.value)} required /></Field></div>
      {type === 'RENTAL' && <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2"><Field label="Locatário"><input className="input" value={renterName} onChange={e => setRenterName(e.target.value)} required /></Field><Field label="CPF/CNPJ"><input className="input" value={renterDocument} onChange={e => setRenterDocument(e.target.value)} /></Field><Field label="Telefone"><input className="input" value={renterPhone} onChange={e => setRenterPhone(e.target.value)} /></Field><Field label="Valor do aluguel"><input className="input" type="number" min="0" step="0.01" value={rentalValue} onChange={e => setRentalValue(e.target.value)} /></Field></div>}
      <div className="mt-4"><Field label="Observações"><textarea className="input min-h-24" value={notes} onChange={e => setNotes(e.target.value)} /></Field></div>
    </section>
    <div className="sticky bottom-3 z-10 flex justify-end"><button type="submit" disabled={submitting || kit.length === 0} className="btn-primary min-w-48 shadow-lg">{submitting ? 'Registrando...' : `Confirmar saída (${totalUnits})`}</button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
