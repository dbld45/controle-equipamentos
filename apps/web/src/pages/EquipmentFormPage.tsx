import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Save, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { api, ApiError, assetUrl } from '../lib/api';
import type { Category, Equipment, EquipmentCondition } from '../types';

interface FormState {
  name: string; model: string; brand: string; categoryId: string; serialNumber: string;
  trackingMode: 'UNIT' | 'BATCH'; totalQuantity: string; condition: EquipmentCondition;
  acquisitionDate: string; acquisitionValue: string; notes: string;
}
const blank: FormState = { name: '', model: '', brand: '', categoryId: '', serialNumber: '', trackingMode: 'UNIT', totalQuantity: '1', condition: 'GOOD', acquisitionDate: '', acquisitionValue: '', notes: '' };

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function EquipmentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<Equipment | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api<Category[]>('/categories').then(setCategories).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar categorias.')); }, []);
  useEffect(() => {
    if (!editing) return;
    setLoading(true);
    api<Equipment>(`/equipments/${id}`).then(e => {
      setExisting(e);
      setPreview(assetUrl(e.photoPath));
      setForm({
        name: e.name, model: e.model || '', brand: e.brand || '', categoryId: String(e.categoryId), serialNumber: e.serialNumber || '',
        trackingMode: e.trackingMode, totalQuantity: String(e.totalQuantity), condition: e.condition,
        acquisitionDate: toDateInput(e.acquisitionDate), acquisitionValue: e.acquisitionValue == null ? '' : String(e.acquisitionValue), notes: e.notes || ''
      });
    }).catch(e => setError(e instanceof ApiError ? e.message : 'Erro ao carregar equipamento.')).finally(() => setLoading(false));
  }, [editing, id]);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const availableCategories = useMemo(() => categories.filter(c => c.isActive || c.id === existing?.categoryId), [categories, existing]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value, ...(key === 'trackingMode' && value === 'UNIT' ? { totalQuantity: '1' } : {}) }));
  }

  function choosePhoto(file: File | null) {
    setPhoto(file);
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : assetUrl(existing?.photoPath));
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!form.name.trim()) return setError('Informe o nome/modelo do equipamento.');
    if (!form.categoryId) return setError('Selecione uma categoria.');
    if (form.trackingMode === 'BATCH' && Number(form.totalQuantity) < 1) return setError('A quantidade total deve ser maior que zero.');
    if (form.acquisitionValue && Number(form.acquisitionValue) < 0) return setError('O valor de aquisição não pode ser negativo.');

    const fd = new FormData();
    const required: Record<string, string> = {
      name: form.name.trim(), categoryId: form.categoryId, trackingMode: form.trackingMode,
      totalQuantity: form.trackingMode === 'UNIT' ? '1' : form.totalQuantity, condition: form.condition
    };
    Object.entries(required).forEach(([k, v]) => fd.append(k, v));
    const optional: Record<string, string> = { model: form.model, brand: form.brand, serialNumber: form.serialNumber, acquisitionDate: form.acquisitionDate, acquisitionValue: form.acquisitionValue, notes: form.notes };
    Object.entries(optional).forEach(([k, v]) => { if (v.trim()) fd.append(k, v.trim()); else if (editing) fd.append(k, ''); });
    if (photo) fd.append('photo', photo);

    setSaving(true);
    try {
      const saved = await api<Equipment>(editing ? `/equipments/${id}` : '/equipments', { method: editing ? 'PATCH' : 'POST', body: fd });
      navigate(`/equipamentos/${saved.id}`, { replace: true });
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o equipamento.'); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading label="Carregando cadastro..." />;

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Link to={editing ? `/equipamentos/${id}` : '/equipamentos'} className="btn-secondary px-3"><ArrowLeft className="h-4 w-4" /></Link><div><p className="text-sm text-slate-500">{editing ? existing?.internalCode : 'Novo patrimônio'}</p><h2 className="text-2xl font-bold">{editing ? 'Editar equipamento' : 'Cadastrar equipamento'}</h2></div></div></div>

    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <section className="card p-5 sm:p-6"><div className="mb-5"><h3 className="font-bold">Identificação</h3><p className="text-sm text-slate-500">Informações principais do item.</p></div><div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2"><label className="label">Nome/modelo *</label><input className="input" value={form.name} onChange={e => change('name', e.target.value)} placeholder="Ex.: Câmera Sony FX3" maxLength={120} required /></div>
        <div><label className="label">Marca</label><input className="input" value={form.brand} onChange={e => change('brand', e.target.value)} placeholder="Sony" maxLength={100} /></div>
        <div><label className="label">Modelo</label><input className="input" value={form.model} onChange={e => change('model', e.target.value)} placeholder="ILME-FX3" maxLength={120} /></div>
        <div><label className="label">Categoria *</label><select className="input" value={form.categoryId} onChange={e => change('categoryId', e.target.value)} required><option value="">Selecione...</option>{availableCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.prefix})</option>)}</select></div>
        <div><label className="label">Número de série</label><input className="input" value={form.serialNumber} onChange={e => change('serialNumber', e.target.value)} placeholder="Opcional" maxLength={120} /></div>
        {editing && <div className="md:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">Código interno:</span> <strong>{existing?.internalCode}</strong> <span className="ml-2 text-xs text-slate-400">Gerado automaticamente e não editável.</span></div>}
      </div></section>

      <section className="card p-5 sm:p-6"><div className="mb-5"><h3 className="font-bold">Estoque e conservação</h3><p className="text-sm text-slate-500">Defina se o cadastro representa uma unidade ou um lote de itens iguais.</p></div><div className="grid gap-5 md:grid-cols-3">
        <div><label className="label">Tipo de controle *</label><select className="input" value={form.trackingMode} onChange={e => change('trackingMode', e.target.value as 'UNIT' | 'BATCH')}><option value="UNIT">Item unitário</option><option value="BATCH">Lote / quantidade</option></select></div>
        <div><label className="label">Quantidade total *</label><input className="input" type="number" min={1} step={1} disabled={form.trackingMode === 'UNIT'} value={form.trackingMode === 'UNIT' ? '1' : form.totalQuantity} onChange={e => change('totalQuantity', e.target.value)} /></div>
        <div><label className="label">Estado de conservação *</label><select className="input" value={form.condition} onChange={e => change('condition', e.target.value as EquipmentCondition)}><option value="NEW">Novo</option><option value="GOOD">Bom</option><option value="REGULAR">Regular</option><option value="MAINTENANCE">Em manutenção</option><option value="WRITTEN_OFF">Baixado</option></select></div>
      </div></section>

      <section className="card p-5 sm:p-6"><div className="mb-5"><h3 className="font-bold">Aquisição e imagem</h3><p className="text-sm text-slate-500">Dados patrimoniais e foto de referência.</p></div><div className="grid gap-6 md:grid-cols-[1fr_1fr_220px]">
        <div><label className="label">Data de aquisição</label><input className="input" type="date" value={form.acquisitionDate} onChange={e => change('acquisitionDate', e.target.value)} /></div>
        <div><label className="label">Valor de aquisição</label><input className="input" type="number" min="0" step="0.01" value={form.acquisitionValue} onChange={e => change('acquisitionValue', e.target.value)} placeholder="0,00" /></div>
        <div className="row-span-2"><label className="label">Foto</label><label className="group flex min-h-[170px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-slate-400">{preview ? <img src={preview} alt="Prévia" className="h-[170px] w-full object-cover" /> : <><Camera className="mb-2 h-7 w-7 text-slate-400" /><span className="text-sm font-semibold text-slate-600">Adicionar foto</span><span className="mt-1 px-4 text-xs text-slate-400">JPG, PNG ou WebP · até 5 MB</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => choosePhoto(e.target.files?.[0] || null)} /></label>{preview && <button type="button" onClick={() => choosePhoto(null)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" />Remover nova seleção</button>}</div>
        <div className="md:col-span-2"><label className="label">Observações</label><textarea className="input min-h-28 resize-y" value={form.notes} onChange={e => change('notes', e.target.value)} maxLength={5000} placeholder="Acessórios que acompanham o item, avarias preexistentes, localização padrão..." /></div>
      </div></section>

      <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Link to={editing ? `/equipamentos/${id}` : '/equipamentos'} className="btn-secondary">Cancelar</Link><button disabled={saving} className="btn-primary"><Save className="h-4 w-4" />{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar equipamento'}</button></div>
    </form>
  </div>;
}
