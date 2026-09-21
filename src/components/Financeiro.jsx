import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Download, Plus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  listarLancamentosFinanceiros, TAXAS_PAGAMENTO_LABELS, BANDEIRAS_LABELS,
  lancarDespesa, CATEGORIAS_DESPESA_LABELS
} from '../firebase/services';
import { carregarImagemComoBase64 } from '../utils/pdfGenerator';
import { OFICINA_INFO } from '../config/oficina';

const DESPESA_VAZIA = { categoria: 'aluguel', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10) };

// Painel financeiro dedicado — existe pra "justificar" o número de Lucro do Mês
// que aparece no painel principal, mostrando o lançamento por trás de cada
// real: qual OS/placa gerou a entrada, e qual taxa de cartão virou saída.
export default function Financeiro() {
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [formDespesa, setFormDespesa] = useState(DESPESA_VAZIA);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);

  useEffect(() => {
    carregar();
  }, [mesRef]);

  async function carregar() {
    setCarregando(true);
    const inicio = new Date(mesRef);
    const fim = new Date(mesRef);
    fim.setMonth(fim.getMonth() + 1);
    fim.setMilliseconds(-1); // último instante do mês corrente
    const lista = await listarLancamentosFinanceiros({ inicio, fim });
    setLancamentos(lista);
    setCarregando(false);
  }

  function mudarMes(delta) {
    setMesRef((prev) => {
      const novo = new Date(prev);
      novo.setMonth(novo.getMonth() + delta);
      return novo;
    });
  }

  async function salvarDespesa() {
    if (!formDespesa.valor || Number(formDespesa.valor) <= 0) return;
    setSalvandoDespesa(true);
    try {
      await lancarDespesa(formDespesa);
      setFormDespesa({ ...DESPESA_VAZIA, categoria: formDespesa.categoria });
      setMostrarForm(false);
      await carregar();
    } finally {
      setSalvandoDespesa(false);
    }
  }

  const entradas = lancamentos.filter((l) => l.tipo === 'entrada').reduce((acc, l) => acc + (l.valor || 0), 0);
  const saidas = lancamentos.filter((l) => l.tipo === 'saida').reduce((acc, l) => acc + (l.valor || 0), 0);
  const lucro = entradas - saidas;

  const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  async function exportarPdf() {
    setExportando(true);
    try {
      const docPdf = new jsPDF({ unit: 'mm', format: 'a4' });

      let textoX = 14;
      if (OFICINA_INFO?.logoUrl) {
        try {
          const logoBase64 = await carregarImagemComoBase64(OFICINA_INFO.logoUrl);
          docPdf.addImage(logoBase64, 14, 10, 30, 20);
          textoX = 48;
        } catch (e) {
          console.warn('Não foi possível carregar a logo no relatório:', e);
        }
      }

      docPdf.setFontSize(16);
      docPdf.setFont('helvetica', 'bold');
      docPdf.text(OFICINA_INFO?.nome || 'Oficina', textoX, 18);
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(`Relatório Financeiro — ${nomeMes}`, textoX, 25);

      docPdf.setDrawColor(200);
      docPdf.line(14, 35, 196, 35);

      // Resumo do mês
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Entradas:', 14, 44);
      docPdf.text('Saídas:', 80, 44);
      docPdf.text('Lucro do mês:', 140, 44);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(61, 163, 93); // oil
      docPdf.text(`R$ ${entradas.toFixed(2)}`, 14, 50);
      docPdf.setTextColor(255, 106, 19); // gauge (alerta/saída)
      docPdf.text(`R$ ${saidas.toFixed(2)}`, 80, 50);
      docPdf.setTextColor(225, 4, 4); // vermelho da marca
      docPdf.text(`R$ ${lucro.toFixed(2)}`, 140, 50);
      docPdf.setTextColor(0, 0, 0);

      // Tabela de lançamentos
      const linhas = lancamentos.map((l) => [
        formatarData(l.data),
        l.tipo === 'entrada' ? 'Entrada' : 'Saída',
        l.descricao || '',
        l.placa || '—',
        rotuloCategoria(l),
        `${l.tipo === 'entrada' ? '+' : '-'} R$ ${Number(l.valor || 0).toFixed(2)}`
      ]);

      autoTable(docPdf, {
        startY: 58,
        head: [['Data', 'Tipo', 'Descrição', 'Placa', 'Categoria/Pagamento', 'Valor']],
        body: linhas,
        theme: 'grid',
        headStyles: { fillColor: [225, 4, 4] },
        styles: { fontSize: 8.5 },
        columnStyles: { 5: { halign: 'right' } }
      });

      docPdf.save(`financeiro_${mesRef.getFullYear()}_${String(mesRef.getMonth() + 1).padStart(2, '0')}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-3xl text-zinc-50 tracking-wide">FINANCEIRO</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-graphite-900 border border-graphite-700 rounded-card px-2 py-1">
            <button onClick={() => mudarMes(-1)} className="text-zinc-400 hover:text-zinc-100 p-1"><ChevronLeft size={18} /></button>
            <span className="text-sm text-zinc-200 capitalize min-w-[140px] text-center">{nomeMes}</span>
            <button onClick={() => mudarMes(1)} className="text-zinc-400 hover:text-zinc-100 p-1"><ChevronRight size={18} /></button>
          </div>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-1 border border-graphite-600 hover:border-torque-500 text-zinc-200 text-sm px-3 py-2 rounded-card"
          >
            <Plus size={14} /> Adicionar despesa
          </button>
          <button
            onClick={exportarPdf}
            disabled={lancamentos.length === 0 || exportando}
            className="flex items-center gap-1 bg-torque-500 hover:bg-torque-400 disabled:opacity-40 text-graphite-950 font-semibold text-sm px-3 py-2 rounded-card"
          >
            <Download size={14} /> {exportando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <section className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4">
          <h2 className="text-sm uppercase text-zinc-500 mb-3">Nova despesa (fixa ou imprevisto)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[10px] text-zinc-500">Categoria</label>
              <select
                value={formDespesa.categoria}
                onChange={(e) => setFormDespesa((f) => ({ ...f, categoria: e.target.value }))}
                className="w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"
              >
                {Object.entries(CATEGORIAS_DESPESA_LABELS).map(([valor, label]) => (
                  <option key={valor} value={valor}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500">Descrição (opcional)</label>
              <input
                value={formDespesa.descricao}
                onChange={(e) => setFormDespesa((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Conta de luz - julho"
                className="w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500">Valor (R$)</label>
              <input
                type="number"
                value={formDespesa.valor}
                onChange={(e) => setFormDespesa((f) => ({ ...f, valor: e.target.value }))}
                className="w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500">Data</label>
              <input
                type="date"
                value={formDespesa.data}
                onChange={(e) => setFormDespesa((f) => ({ ...f, data: e.target.value }))}
                className="w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"
              />
            </div>
          </div>
          <button
            onClick={salvarDespesa}
            disabled={salvandoDespesa || !formDespesa.valor}
            className="mt-3 flex items-center gap-1 bg-torque-500 hover:bg-torque-400 disabled:opacity-40 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card"
          >
            {salvandoDespesa ? 'Salvando...' : 'Salvar despesa'}
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardResumo icon={TrendingUp} cor="text-oil-500" titulo="Entradas" valor={entradas} />
        <CardResumo icon={TrendingDown} cor="text-gauge-500" titulo="Saídas" valor={saidas} />
        <CardResumo icon={DollarSign} cor="text-torque-500" titulo="Lucro do Mês" valor={lucro} destaque />
      </div>

      <section className="bg-graphite-900 border border-graphite-700 rounded-card overflow-hidden">
        <h2 className="font-display text-xl text-zinc-100 px-4 pt-4">
          LANÇAMENTOS — justificando o lucro acima, item por item
        </h2>
        <table className="w-full text-sm mt-3">
          <thead className="text-zinc-500 text-xs uppercase border-t border-graphite-700">
            <tr>
              <th className="text-left px-4 py-2">Data</th>
              <th className="text-left px-4 py-2">Descrição</th>
              <th className="text-left px-4 py-2">Placa</th>
              <th className="text-left px-4 py-2">Categoria/Pagamento</th>
              <th className="text-right px-4 py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && lancamentos.length === 0 && (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-6">Nenhum lançamento neste mês.</td></tr>
            )}
            {carregando && (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-6">Carregando...</td></tr>
            )}
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-t border-graphite-800">
                <td className="px-4 py-2 text-zinc-400">{formatarData(l.data)}</td>
                <td className="px-4 py-2 text-zinc-200">{l.descricao}</td>
                <td className="px-4 py-2 font-mono text-torque-300">{l.placa || '—'}</td>
                <td className="px-4 py-2 text-zinc-400">
                  {rotuloCategoria(l)}
                  {l.bandeira && <span className="text-zinc-600"> · {BANDEIRAS_LABELS[l.bandeira]}</span>}
                </td>
                <td className={`px-4 py-2 text-right font-medium ${l.tipo === 'entrada' ? 'text-oil-400' : 'text-gauge-500'}`}>
                  {l.tipo === 'entrada' ? '+' : '−'} R$ {Number(l.valor || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CardResumo({ icon: Icon, cor, titulo, valor, destaque }) {
  return (
    <div className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4 pb-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className={cor} />
        <span className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</span>
      </div>
      <p className={`font-display text-3xl ${destaque ? cor : 'text-zinc-50'}`}>R$ {valor.toFixed(2)}</p>
    </div>
  );
}

function rotuloCategoria(l) {
  if (l.tipo_pagamento) return TAXAS_PAGAMENTO_LABELS[l.tipo_pagamento] || '—';
  if (l.categoria === 'taxa_cartao') return 'Taxa cartão';
  if (CATEGORIAS_DESPESA_LABELS[l.categoria]) return CATEGORIAS_DESPESA_LABELS[l.categoria];
  return l.categoria || '—';
}

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
