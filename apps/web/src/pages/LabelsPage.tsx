import { useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { CheckSquare, FileDown, Search, Square, Tags } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Equipment } from '../types';

interface ListResponse { items: Equipment[]; pagination: { page: number; pageSize: number; total: number; pages: number } }

function barcodeDataUrl(value: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 220;
  JsBarcode(canvas, value, { format: 'CODE128', displayValue: false, margin: 10, height: 90, width: 3 });
  return canvas.toDataURL('image/png');
}

export function LabelsPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const all: Equipment[] = [];
        let page = 1, pages = 1;
        do {
          const r = await api<ListResponse>(`/equipments?page=${page}&pageSize=100&sortBy=internalCode&sortOrder=asc`);
          all.push(...r.items); pages = Math.max(1, r.pagination.pages); page += 1;
        } while (page <= pages);
        setItems(all);
      } catch (e) { setError(e instanceof ApiError ? e.message : 'Erro ao carregar equipamentos.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? items : items.filter(i => [i.internalCode, i.name, i.brand, i.category?.name].join(' ').toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id: number) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const allVisibleSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
  const toggleVisible = () => setSelected(prev => {
    const next = new Set(prev);
    if (allVisibleSelected) filtered.forEach(i => next.delete(i.id)); else filtered.forEach(i => next.add(i.id));
    return next;
  });

  function generatePdf() {
    const chosen = items.filter(i => selected.has(i.id));
    if (!chosen.length) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginX = 7, marginY = 8, colW = 63.5, rowH = 37, gapX = 2.5, gapY = 2.5;
    const cols = 3, rows = 7, perPage = cols * rows;

    chosen.forEach((item, index) => {
      if (index > 0 && index % perPage === 0) pdf.addPage();
      const local = index % perPage;
      const col = local % cols;
      const row = Math.floor(local / cols);
      const x = marginX + col * (colW + gapX);
      const y = marginY + row * (rowH + gapY);
      pdf.setDrawColor(210, 215, 222);
      pdf.roundedRect(x, y, colW, rowH, 1.5, 1.5, 'S');
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      const name = String(item.name).length > 34 ? `${String(item.name).slice(0, 31)}...` : item.name;
      pdf.text(name, x + 3, y + 6, { maxWidth: colW - 6 });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text([item.brand || 'Sem marca', item.category?.name || 'Sem categoria'].join(' - '), x + 3, y + 10.5, { maxWidth: colW - 6 });
      const img = barcodeDataUrl(item.internalCode);
      pdf.addImage(img, 'PNG', x + 5, y + 13.5, colW - 10, 13);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(10);
      pdf.text(item.internalCode, x + colW / 2, y + 32, { align: 'center' });
    });
    pdf.save(`etiquetas-controle-av-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-slate-500">Selecione equipamentos e gere uma folha A4 com etiquetas Code 128 em 3 colunas.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Impressão de etiquetas</h2></div>
      <button className="btn-primary" disabled={!selected.size} onClick={generatePdf}><FileDown className="h-4 w-4" />Gerar PDF ({selected.size})</button>
    </div>

    <section className="card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-10" placeholder="Buscar código, nome, marca ou categoria..." value={query} onChange={e => setQuery(e.target.value)} /></div><button className="btn-secondary" onClick={toggleVisible}>{allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div>
    </section>

    <section className="card overflow-hidden">
      {loading ? <div className="p-6 text-sm text-slate-500">Carregando equipamentos...</div> : error ? <div className="p-6 text-sm text-red-700">{error}</div> : filtered.length === 0 ? <div className="p-10 text-center"><Tags className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold">Nenhum equipamento encontrado.</p></div> : <div className="divide-y divide-slate-100">{filtered.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-3 p-4 hover:bg-slate-50"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono text-sm font-bold text-slate-900">{item.internalCode}</span><span className="font-medium text-slate-800">{item.name}</span></div><div className="mt-0.5 text-xs text-slate-500">{item.brand || 'Sem marca'} · {item.category?.name || 'Sem categoria'}</div></div><div className="hidden text-xs text-slate-400 sm:block">Code 128</div></label>)}</div>}
    </section>
    <p className="text-xs text-slate-400">Layout padrão: A4, 3 colunas, até 21 etiquetas por página. Faça um teste de impressão em folha comum antes de usar etiquetas adesivas.</p>
  </div>;
}
