import { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { api, ApiError } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/format';
import type { ReportResponse } from '../types';

type ReportType = ReportResponse['type'];

const reportOptions: { type: ReportType; label: string; description: string }[] = [
  { type: 'inventory', label: 'Inventário', description: 'Saldo atual de todos os equipamentos.' },
  { type: 'out', label: 'Fora do estoque', description: 'Itens em externa, aluguel ou devolução parcial.' },
  { type: 'overdue', label: 'Atrasos', description: 'Itens com previsão de retorno vencida.' },
  { type: 'history', label: 'Histórico por período', description: 'Movimentações realizadas no intervalo.' },
  { type: 'usage', label: 'Uso por equipamento', description: 'Ranking de uso no período.' }
];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); }

function translateType(v: unknown) { return v === 'RENTAL' ? 'Aluguel' : v === 'EXTERNAL' ? 'Externa' : String(v ?? ''); }
function translateStatus(v: unknown) {
  const map: Record<string, string> = { OPEN: 'Aberta', PARTIALLY_RETURNED: 'Parcial', RETURNED: 'Devolvida', OVERDUE: 'Atrasada', CANCELLED: 'Cancelada' };
  return map[String(v)] || String(v ?? '');
}

function rowsForExport(type: ReportType, data: Record<string, unknown>[]) {
  if (type === 'inventory') return data.map(r => ({ Código: r.internalCode, Equipamento: r.name, Marca: r.brand ?? '', Categoria: r.category, Total: r.totalQuantity, Disponível: r.availableQuantity, Fora: r.quantityOut, Manutenção: r.maintenanceQuantity, Status: r.status }));
  if (type === 'usage') return data.map(r => ({ Código: r.internalCode, Equipamento: r.equipmentName, Categoria: r.category, Movimentações: r.movementCount, 'Quantidade movimentada': r.quantityMoved, Externa: r.externalQuantity, Aluguel: r.rentalQuantity, 'Último uso': formatDate(r.lastUseAt as any, true) }));
  if (type === 'history') return data.map(r => ({ Movimento: r.movementCode, Tipo: translateType(r.type), Status: translateStatus(r.status), Saída: formatDate(r.checkoutAt as any, true), Responsável: r.responsibleName, Destino: r.destination, Projeto: r.projectClient ?? '', Código: r.internalCode, Equipamento: r.equipmentName, Quantidade: r.quantityOut, Devolvido: r.quantityReturned, 'Valor aluguel': r.rentalValue == null ? '' : formatCurrency(Number(r.rentalValue)) }));
  return data.map(r => ({ Movimento: r.movementCode, Tipo: translateType(r.type), Status: translateStatus(r.status), Responsável: r.responsibleName, Destino: r.destination, 'Retorno previsto': formatDate(r.expectedReturnAt as any, true), Código: r.internalCode, Equipamento: r.equipmentName, Categoria: r.category, Pendente: r.quantityPending }));
}

function escapeCsv(v: unknown) { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('inventory');
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(isoDate(new Date()));
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const needsPeriod = type === 'history' || type === 'usage';

  async function load() {
    setLoading(true); setError('');
    const params = new URLSearchParams({ type });
    if (needsPeriod) { params.set('start', start); params.set('end', end); }
    try { setReport(await api<ReportResponse>(`/reports?${params}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível gerar o relatório.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [type]);
  const exported = useMemo(() => rowsForExport(type, report?.data || []), [type, report]);
  const headers = exported.length ? Object.keys(exported[0]) : [];

  function exportCsv() {
    if (!exported.length) return;
    const csv = '\uFEFF' + [headers.join(';'), ...exported.map(row => headers.map(h => escapeCsv((row as any)[h])).join(';'))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-${type}-${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function exportXlsx() {
    if (!exported.length) return;
    const ws = XLSX.utils.json_to_sheet(exported);
    ws['!cols'] = headers.map(h => ({ wch: Math.min(32, Math.max(12, h.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio-${type}-${isoDate(new Date())}.xlsx`);
  }

  function exportPdf() {
    if (!exported.length) return;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const option = reportOptions.find(o => o.type === type)!;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(`Controle AV - ${option.label}`, 12, 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(90); pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${exported.length} registro(s)`, 12, 17);
    const chosen = headers.slice(0, 7);
    const pageW = 297, margin = 10, usable = pageW - margin * 2, colW = usable / chosen.length;
    let y = 24;
    const drawHeader = () => {
      pdf.setFillColor(15, 23, 42); pdf.rect(margin, y, usable, 8, 'F');
      pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7);
      chosen.forEach((h, i) => pdf.text(String(h).slice(0, 22), margin + i * colW + 1.5, y + 5));
      y += 8; pdf.setTextColor(20); pdf.setFont('helvetica', 'normal');
    };
    drawHeader();
    exported.forEach((row, idx) => {
      if (y > 195) { pdf.addPage(); y = 14; drawHeader(); }
      if (idx % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, usable, 7, 'F'); }
      pdf.setFontSize(6.5);
      chosen.forEach((h, i) => { const text = String((row as any)[h] ?? '').replace(/\s+/g, ' '); pdf.text(text.length > 28 ? `${text.slice(0, 25)}...` : text, margin + i * colW + 1.5, y + 4.7, { maxWidth: colW - 3 }); });
      y += 7;
    });
    pdf.save(`relatorio-${type}-${isoDate(new Date())}.pdf`);
  }

  return <div className="space-y-5">
    <div><p className="text-sm text-slate-500">Consulte dados operacionais e exporte em PDF, Excel ou CSV.</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Relatórios</h2></div>
    <section className="card p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-5">{reportOptions.map(o => <button key={o.type} onClick={() => setType(o.type)} className={`rounded-xl border p-3 text-left transition ${type === o.type ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="text-sm font-bold">{o.label}</div><div className={`mt-1 text-xs ${type === o.type ? 'text-slate-300' : 'text-slate-500'}`}>{o.description}</div></button>)}</div>
      {needsPeriod && <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"><div><label className="label">Data inicial</label><input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div><label className="label">Data final</label><input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div><button className="btn-primary" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button></div>}
    </section>

    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="font-bold">{reportOptions.find(o => o.type === type)?.label}</h3><p className="text-xs text-slate-500">{report?.data.length ?? 0} registro(s)</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={!exported.length} onClick={exportPdf}><FileText className="h-4 w-4" />PDF</button><button className="btn-secondary" disabled={!exported.length} onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4" />Excel</button><button className="btn-secondary" disabled={!exported.length} onClick={exportCsv}><FileDown className="h-4 w-4" />CSV</button></div></div>
      {loading ? <div className="p-8 text-sm text-slate-500">Gerando relatório...</div> : error ? <div className="p-6 text-sm text-red-700">{error}</div> : !exported.length ? <div className="p-10 text-center text-sm text-slate-500">Nenhum registro encontrado para este relatório.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{exported.slice(0, 250).map((row, i) => <tr key={i} className="hover:bg-slate-50"><>{headers.map(h => <td key={h} className="max-w-[260px] px-4 py-3 text-slate-700">{String((row as any)[h] ?? '')}</td>)}</></tr>)}</tbody></table>{exported.length > 250 && <div className="border-t p-3 text-center text-xs text-slate-500">Prévia limitada a 250 linhas. As exportações incluem todos os registros.</div>}</div>}
    </section>
  </div>;
}
