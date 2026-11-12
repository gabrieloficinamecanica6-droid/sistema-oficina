import React, { useEffect, useState } from 'react';
import { Plus, FileDown, MessageCircle, Check, X, Pencil, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  listarOrcamentos, criarOrcamento, atualizarOrcamento, atualizarStatusOrcamento,
  excluirOrcamento, calcularTotais, timestampParaInput
} from '../firebase/orcamentosService';
import { carregarImagemComoBase64 } from '../utils/pdfGenerator';
import { OFICINA_INFO } from '../config/oficina';

const STATUS = {
  pendente: { label: 'Pendente', cls: 'text-gauge-500 border-gauge-500' },
  aprovado: { label: 'Aprovado', cls: 'text-oil-400 border-oil-500' },
  recusado: { label: 'Recusado', cls: 'text-red-400 border-red-500' }
};

// ---------- datas (sempre no fuso LOCAL) ----------
const p2 = (n) => String(n).padStart(2, '0');
const strData = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hojeLocal = () => strData(new Date());
const somarDias = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return strData(d); };

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const numeroFmt = (n) => String(n || 0).padStart(4, '0');

const novoForm = () => ({
  clienteNome: '', telefone: '', placa: '', modelo: '', descricao: '',
  valorServico: '', observacoes: '', data: hojeLocal(), validade: somarDias(7), itens: []
});
const novoItem = () => ({ nome: '', quantidade: '1', valorUnit: '' });

// ---------- PDF ----------
async function gerarPdfOrcamento(o) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let textoX = 14;
  if (OFICINA_INFO?.logoUrl) {
    try {
      const logo = await carregarImagemComoBase64(OFICINA_INFO.logoUrl);
      pdf.addImage(logo, 14, 10, 30, 20);
      textoX = 48;
    } catch (e) {
      console.warn('Não foi possível carregar a logo:', e);
    }
  }
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(OFICINA_INFO?.nome || 'Oficina', textoX, 18);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`ORÇAMENTO Nº ${numeroFmt(o.numero)}`, textoX, 25);
  const contato = [OFICINA_INFO?.telefone, OFICINA_INFO?.endereco].filter(Boolean).join('  |  ');
  if (contato) { pdf.setFontSize(8); pdf.text(contato, textoX, 31); }
  pdf.setDrawColor(200);
  pdf.line(14, 35, 196, 35);

  // Cliente / veículo
  let y = 44;
  pdf.setFontSize(10);
  const linha = (rotulo, valor) => {
    pdf.setFont('helvetica', 'bold'); pdf.text(rotulo, 14, y);
    pdf.setFont('helvetica', 'normal'); pdf.text(String(valor || '—'), 42, y);
    y += 6;
  };
  linha('Cliente:', o.clienteNome);
  linha('Telefone:', o.telefone);
  linha('Veículo:', [o.placa, o.modelo].filter(Boolean).join(' · '));
  linha('Data:', formatarData(o.data));
  linha('Válido até:', formatarData(o.validade));

  // Serviço
  y += 2;
  pdf.setFont('helvetica', 'bold'); pdf.text('Serviço a executar', 14, y); y += 5;
  pdf.setFont('helvetica', 'normal');
  const desc = pdf.splitTextToSize(o.descricao || '—', 180);
  pdf.text(desc, 14, y);
  y += desc.length * 4.8 + 4;

  // Peças
  if (o.itens?.length) {
    autoTable(pdf, {
      startY: y,
      head: [['Peça', 'Qtd', 'Valor unit.', 'Subtotal']],
      body: o.itens.map((i) => [
        i.nome, String(i.quantidade), brl(i.valorUnit), brl(i.quantidade * i.valorUnit)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [225, 4, 4] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { bottom: 25 }
    });
    y = pdf.lastAutoTable.finalY + 8;
  }

  // Totais
  if (y > 235) { pdf.addPage(); y = 20; }
  const tot = (rotulo, valor, destaque) => {
    pdf.setFont('helvetica', destaque ? 'bold' : 'normal');
    pdf.setFontSize(destaque ? 12 : 10);
    pdf.text(rotulo, 130, y);
    pdf.text(valor, 196, y, { align: 'right' });
    y += destaque ? 8 : 6;
  };
  tot('Mão de obra:', brl(o.valorServico));
  tot('Peças:', brl(o.totalPecas));
  tot('TOTAL:', brl(o.total), true);

  if (o.observacoes) {
    y += 2;
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.text('Observações', 14, y); y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(pdf.splitTextToSize(o.observacoes, 180), 14, y);
  }

  // Rodapé em todas as páginas: sem valor fiscal
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(200); pdf.line(14, 280, 196, 280);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(150, 0, 0);
    pdf.text('DOCUMENTO SEM VALOR FISCAL', 105, 286, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 100, 100);
    pdf.text('Este documento não substitui nota fiscal e não possui validade fiscal ou tributária.', 105, 290, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }
  pdf.save(`orcamento_${numeroFmt(o.numero)}.pdf`);
}

// ---------- WhatsApp (envio manual, sem API) ----------
function abrirWhatsApp(o) {
  let n = (o.telefone || '').replace(/\D/g, '');
  if (!n) { alert('Este orçamento não tem telefone.'); return; }
  if (n.length <= 11) n = `55${n}`;
  const msg = `Olá ${o.clienteNome}! Segue o orçamento nº ${numeroFmt(o.numero)}` +
    `${o.placa ? ` do veículo ${o.placa}` : ''}: total de ${brl(o.total)}, ` +
    `válido até ${formatarData(o.validade)}. (Baixe o PDF e anexe nesta conversa.)`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, '_blank');
}

const inputCls = 'w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500';
const btnCls = 'flex items-center gap-1 border border-graphite-600 hover:border-torque-500 text-zinc-200 text-xs px-2.5 py-1.5 rounded-card';

export default function Orcamentos() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(novoForm());
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    try { setLista(await listarOrcamentos()); setErro(''); }
    catch (e) { setErro(`Não foi possível carregar: ${e.message}`); }
    finally { setCarregando(false); }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (idx, k, v) =>
    setForm((f) => ({ ...f, itens: f.itens.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }));
  const totais = calcularTotais(form);

  function abrirNovo() {
    setEditando(null); setForm(novoForm()); setErro(''); setAberto((v) => !v);
  }

  function editar(o) {
    setEditando(o);
    setForm({
      clienteNome: o.clienteNome || '', telefone: o.telefone || '', placa: o.placa || '',
      modelo: o.modelo || '', descricao: o.descricao || '', valorServico: String(o.valorServico || ''),
      observacoes: o.observacoes || '', data: timestampParaInput(o.data), validade: timestampParaInput(o.validade),
      itens: (o.itens || []).map((i) => ({ nome: i.nome, quantidade: String(i.quantidade), valorUnit: String(i.valorUnit) }))
    });
    setAberto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvar() {
    setErro('');
    if (!form.clienteNome.trim()) return setErro('Informe o nome do cliente.');
    if (!form.descricao.trim()) return setErro('Descreva o serviço.');
    if (totais.total <= 0) return setErro('O total do orçamento precisa ser maior que zero.');
    if (!form.data || !form.validade) return setErro('Informe a data e a validade.');
    setSalvando(true);
    try {
      if (editando) await atualizarOrcamento(editando.id, form);
      else await criarOrcamento(form);
      setAberto(false); setEditando(null); setForm(novoForm());
      await carregar();
    } catch (e) { setErro(`Erro ao salvar: ${e.message}`); }
    finally { setSalvando(false); }
  }

  async function mudarStatus(o, status) {
    try { await atualizarStatusOrcamento(o.id, status); await carregar(); }
    catch (e) { setErro(e.message); }
  }

  async function excluir(o) {
    if (!window.confirm(`Excluir o orçamento nº ${numeroFmt(o.numero)}?`)) return;
    try { await excluirOrcamento(o.id); await carregar(); }
    catch (e) { setErro(e.message); }
  }

  const visiveis = lista.filter((o) => filtro === 'todos' || o.status === filtro);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-3xl text-zinc-50 tracking-wide">ORÇAMENTOS</h1>
        <button onClick={abrirNovo}
          className="flex items-center gap-1 bg-torque-500 hover:bg-torque-400 text-graphite-950 font-semibold text-sm px-3 py-2 rounded-card">
          <Plus size={14} /> Novo orçamento
        </button>
      </div>

      {erro && <div className="border border-red-500 text-red-300 text-sm rounded-card px-3 py-2">{erro}</div>}

      {aberto && (
        <section className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4 space-y-3">
          <h2 className="text-sm uppercase text-zinc-500">
            {editando ? `Editando orçamento nº ${numeroFmt(editando.numero)}` : 'Novo orçamento'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-[10px] text-zinc-500">Cliente *</label>
              <input className={inputCls} value={form.clienteNome} onChange={(e) => set('clienteNome', e.target.value)} /></div>
            <div><label className="text-[10px] text-zinc-500">Telefone (WhatsApp)</label>
              <input className={inputCls} type="tel" inputMode="tel" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} /></div>
            <div><label className="text-[10px] text-zinc-500">Placa</label>
              <input className={`${inputCls} uppercase`} value={form.placa} onChange={(e) => set('placa', e.target.value.toUpperCase())} /></div>
            <div><label className="text-[10px] text-zinc-500">Modelo</label>
              <input className={inputCls} value={form.modelo} onChange={(e) => set('modelo', e.target.value)} /></div>
            <div><label className="text-[10px] text-zinc-500">Data</label>
              <input className={inputCls} type="date" value={form.data} onChange={(e) => set('data', e.target.value)} /></div>
            <div><label className="text-[10px] text-zinc-500">Válido até</label>
              <input className={inputCls} type="date" value={form.validade} onChange={(e) => set('validade', e.target.value)} /></div>
          </div>

          <div><label className="text-[10px] text-zinc-500">Serviço a executar *</label>
            <textarea rows={3} className={inputCls} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} /></div>

          <div><label className="text-[10px] text-zinc-500">Mão de obra (R$)</label>
            <input className={inputCls} type="number" step="0.01" inputMode="decimal" value={form.valorServico} onChange={(e) => set('valorServico', e.target.value)} /></div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-zinc-500">Peças (opcional)</label>
              <button type="button" onClick={() => set('itens', [...form.itens, novoItem()])} className={btnCls}>
                <Plus size={12} /> Peça
              </button>
            </div>
            <div className="space-y-2">
              {form.itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input className={`${inputCls} !mt-0 col-span-12 sm:col-span-6`} placeholder="Peça" value={it.nome} onChange={(e) => setItem(idx, 'nome', e.target.value)} />
                  <input className={`${inputCls} !mt-0 col-span-4 sm:col-span-2`} type="number" min="1" inputMode="numeric" placeholder="Qtd" value={it.quantidade} onChange={(e) => setItem(idx, 'quantidade', e.target.value)} />
                  <input className={`${inputCls} !mt-0 col-span-6 sm:col-span-3`} type="number" step="0.01" inputMode="decimal" placeholder="Valor unit." value={it.valorUnit} onChange={(e) => setItem(idx, 'valorUnit', e.target.value)} />
                  <button type="button" onClick={() => set('itens', form.itens.filter((_, i) => i !== idx))}
                    className="col-span-2 sm:col-span-1 flex justify-center text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <div><label className="text-[10px] text-zinc-500">Observações</label>
            <input className={inputCls} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></div>

          <div className="bg-graphite-800 rounded-card p-3 text-sm space-y-1">
            <div className="flex justify-between text-zinc-400"><span>Mão de obra</span><span>{brl(totais.valorServico)}</span></div>
            <div className="flex justify-between text-zinc-400"><span>Peças</span><span>{brl(totais.totalPecas)}</span></div>
            <div className="flex justify-between font-semibold text-zinc-50 pt-1 border-t border-graphite-600"><span>Total</span><span>{brl(totais.total)}</span></div>
          </div>

          <div className="flex gap-2">
            <button onClick={salvar} disabled={salvando}
              className="bg-torque-500 hover:bg-torque-400 disabled:opacity-40 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card">
              {salvando ? 'Salvando...' : 'Salvar orçamento'}
            </button>
            <button onClick={() => { setAberto(false); setEditando(null); }}
              className="border border-graphite-600 text-zinc-300 text-sm px-4 py-2 rounded-card">Cancelar</button>
          </div>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {[['todos', 'Todos'], ['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados']].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${filtro === k ? 'border-torque-500 text-torque-300' : 'border-graphite-700 text-zinc-400'}`}>{l}</button>
        ))}
      </div>

      {carregando && <p className="text-center text-zinc-500 py-6">Carregando...</p>}
      {!carregando && visiveis.length === 0 && <p className="text-center text-zinc-500 py-6">Nenhum orçamento.</p>}

      <div className="space-y-3">
        {visiveis.map((o) => (
          <div key={o.id} className="bg-graphite-900 border border-graphite-700 rounded-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-100 font-medium">#{numeroFmt(o.numero)} · {o.clienteNome}</p>
                <p className="text-xs text-zinc-500">
                  {o.placa ? <span className="font-mono text-torque-300">{o.placa}</span> : 'Sem placa'}
                  {o.modelo && ` · ${o.modelo}`} · {formatarData(o.data)} · válido até {formatarData(o.validade)}
                </p>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{o.descricao}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-2xl text-zinc-50">{brl(o.total)}</p>
                <span className={`inline-block text-[10px] uppercase border rounded-full px-2 py-0.5 ${STATUS[o.status]?.cls}`}>
                  {STATUS[o.status]?.label || o.status}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => gerarPdfOrcamento(o)} className={btnCls}><FileDown size={13} /> PDF</button>
              <button onClick={() => abrirWhatsApp(o)} className={btnCls}><MessageCircle size={13} /> WhatsApp</button>
              {o.status === 'pendente' && (<>
                <button onClick={() => editar(o)} className={btnCls}><Pencil size={13} /> Editar</button>
                <button onClick={() => mudarStatus(o, 'aprovado')} className={`${btnCls} !border-oil-500 !text-oil-400`}><Check size={13} /> Aprovar</button>
                <button onClick={() => mudarStatus(o, 'recusado')} className={`${btnCls} !border-red-500 !text-red-400`}><X size={13} /> Recusar</button>
              </>)}
              {o.status !== 'pendente' && (
                <button onClick={() => mudarStatus(o, 'pendente')} className={btnCls}>Voltar p/ pendente</button>
              )}
              <button onClick={() => excluir(o)} className={`${btnCls} !text-red-400`}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
