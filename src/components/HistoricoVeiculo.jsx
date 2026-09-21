import React, { useState } from 'react';
import { Search, FileText, MessageCircle, ChevronDown, ChevronUp, ExternalLink, Pencil, Plus, Trash2, X, Check, Link as LinkIcon } from 'lucide-react';
import {
  buscarVeiculoPorPlaca, historicoDoVeiculo, finalizarOS, atualizarOS,
  atualizarStatusOperacional, STATUS_OPERACIONAL, STATUS_OPERACIONAL_LABELS,
  TAXAS_PAGAMENTO_LABELS, BANDEIRAS_LABELS, removerOS
} from '../firebase/services';
import { gerarPdfOS } from '../utils/pdfGenerator';
import { gerarLinkWhatsAppComPdf } from '../utils/whatsapp';
import { OFICINA_INFO } from '../config/oficina';
import EditarOSModal from './EditarOSModal.jsx';

const ITEM_VAZIO = { nome_peca: '', fornecedor: '', quantidade: 1, preco_unit: 0, custo_unit: 0, validade_garantia: '', garantia_peca_url: '' };

export default function HistoricoVeiculo() {
  const [placa, setPlaca] = useState('');
  const [veiculo, setVeiculo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [processandoId, setProcessandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [osParaEditar, setOsParaEditar] = useState(null);
  const [edicao, setEdicao] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [pagamentoSelecionado, setPagamentoSelecionado] = useState({});
  const [pagamentoParcelas, setPagamentoParcelas] = useState({});
  const [pagamentoBandeira, setPagamentoBandeira] = useState({});

  async function buscar() {
    if (!placa) return;
    const v = await buscarVeiculoPorPlaca(placa);
    const h = await historicoDoVeiculo(placa);
    setVeiculo(v);
    setHistorico(h);
  }

  async function handleMudarStatus(os, novoStatus) {
    await atualizarStatusOperacional(veiculo.placa, os.id, novoStatus);
    buscar();
  }

  function abrirEdicao(os) {
    setOsParaEditar({ ...os, placa: veiculo?.placa || os.placa });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEdicao(null);
  }

  function atualizarItemEdicao(idx, campo, valor) {
    setEdicao((prev) => ({
      ...prev,
      itens: prev.itens.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it))
    }));
  }

  function adicionarItemEdicao() {
    setEdicao((prev) => ({ ...prev, itens: [...prev.itens, { ...ITEM_VAZIO }] }));
  }

  function removerItemEdicao(idx) {
    setEdicao((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }));
  }

  async function salvarEdicao(os) {
    setSalvandoEdicao(true);
    try {
      const itensProcessados = edicao.itens.map((item) => ({
        ...item,
        quantidade: Number(item.quantidade) || 0,
        preco_unit: Number(item.preco_unit) || 0,
        custo_unit: Number(item.custo_unit) || 0,
        garantia_peca_url: (item.garantia_peca_url || '').trim()
      }));

      await atualizarOS({
        placa: veiculo.placa,
        idOs: os.id,
        descricao_servico: edicao.descricao_servico,
        km_registrado: edicao.km_registrado,
        valor_servico_tecnico: edicao.valor_servico_tecnico,
        nome_mecanico: edicao.nome_mecanico,
        observacao: edicao.observacao,
        cliente_nome: edicao.cliente_nome,
        cliente_telefone: edicao.cliente_telefone,
        itens: itensProcessados
      });
      setEditandoId(null);
      setEdicao(null);
      buscar();
    } catch (e) {
      alert(e.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleBaixarComprovante(os) {
    const pdfDoc = await gerarPdfOS({ veiculo, os, oficina: OFICINA_INFO });
    pdfDoc.save(`Comprovante_${veiculo.placa}_${os.id}.pdf`);
  }

  async function handleRemoverOS(os) {
    const confirmacao = window.confirm(
      `⚠️ Tem certeza que deseja remover a OS ${os.id}?\n\nEsta ação é IRREVERSÍVEL!`
    );
    if (!confirmacao) return;

    setProcessandoId(os.id);
    try {
      await removerOS(veiculo.placa, os.id);
      alert('✅ OS removida com sucesso!');
      buscar();
    } catch (e) {
      alert(`❌ Erro: ${e.message}`);
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleFinalizar(os) {
    const tipo_pagamento = pagamentoSelecionado[os.id];
    if (!tipo_pagamento) {
      alert('Selecione a forma de pagamento antes de finalizar.');
      return;
    }
    setProcessandoId(os.id);
    try {
      const resultado = await finalizarOS({
        placa: veiculo.placa,
        idOs: os.id,
        itens: os.itens,
        valor_servico_tecnico: os.valor_servico_tecnico || 0,
        tipo_pagamento,
        parcelas: pagamentoParcelas[os.id] || 1,
        bandeira: pagamentoBandeira[os.id] || 'visa_mastercard'
      });

      const osAtualizada = { ...os, ...resultado };
      const pdfDoc = await gerarPdfOS({ veiculo, os: osAtualizada, oficina: OFICINA_INFO });
      pdfDoc.save(`OS_${os.id}_${veiculo.placa}.pdf`);

      buscar(); // recarrega o histórico (OS agora sai da lista de ativos) — a OS já está salva a partir daqui

      // Passo separado: se isso falhar, a OS já foi finalizada e salva acima —
      // não é um erro de "não salvou", só o WhatsApp que não abriu sozinho.
      try {
        const { linkWhatsApp } = gerarLinkWhatsAppComPdf({ telefone: veiculo.cliente_telefone, veiculo });
        window.open(linkWhatsApp, '_blank');
      } catch (erroWhats) {
        console.warn('Não foi possível abrir o WhatsApp automaticamente:', erroWhats);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-zinc-50 tracking-wide">HISTÓRICO POR PLACA</h1>

      <div className="flex gap-2">
        <input
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Digite a placa (ex: ABC1D23)"
          className="flex-1 bg-graphite-800 border border-graphite-600 rounded-card px-4 py-3 text-zinc-100 font-mono tracking-widest focus:outline-none focus:border-torque-500"
        />
        <button onClick={buscar} className="bg-torque-500 hover:bg-torque-400 text-graphite-950 font-semibold px-5 rounded-card flex items-center gap-2">
          <Search size={18} /> Buscar
        </button>
      </div>

      {veiculo && (
        <div className="bg-graphite-900 border border-graphite-700 rounded-card p-4">
          <p className="font-display text-xl text-zinc-50">{veiculo.placa} — {veiculo.modelo}</p>
          <p className="text-sm text-zinc-400">{veiculo.cliente_nome} · {veiculo.cliente_telefone}</p>
        </div>
      )}

      <div className="relative pl-6 border-l-2 border-graphite-700 space-y-4">
        {historico.map((os) => (
          <div key={os.id} className="relative">
            <span className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full ${os.status === 'aberta' ? 'bg-torque-500' : 'bg-oil-500'}`} />
            <div className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4 pb-5">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setExpandido(expandido === os.id ? null : os.id)}
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">OS {os.id} — {os.descricao_servico}</p>
                  <p className="text-xs text-zinc-500">{formatarData(os.aberta_em)} · {os.status === 'aberta' ? 'Em andamento' : 'Finalizada'}</p>
                </div>
                {expandido === os.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandido === os.id && editandoId !== os.id && (
                <div className="mt-3 space-y-2">
                  <table className="w-full text-xs">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="text-left">Peça</th>
                        <th className="text-left">Fornecedor</th>
                        <th className="text-left">Validade Garantia</th>
                        <th className="text-left">Comprovante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(os.itens || []).map((item, i) => (
                        <tr key={i} className="border-t border-graphite-800">
                          <td className="py-1">{item.nome_peca}</td>
                          <td className="py-1 text-zinc-400">{item.fornecedor}</td>
                          <td className="py-1 text-zinc-400">{item.validade_garantia || '—'}</td>
                          <td className="py-1">
                            {item.garantia_peca_url ? (
                              <a
                                href={item.garantia_peca_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-torque-400 hover:text-torque-300"
                              >
                                Ver comprovante <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-zinc-600">Sem anexo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {os.nome_mecanico && (
                    <p className="text-xs text-zinc-400">Mecânico responsável: <span className="text-zinc-200">{os.nome_mecanico}</span></p>
                  )}
                  {os.observacao && (
                    <p className="text-xs bg-gauge-500/10 border border-gauge-500/30 text-gauge-300 rounded-card px-3 py-2">
                      📋 <strong>Observação:</strong> {os.observacao}
                    </p>
                  )}
                  {os.valor_servico_tecnico > 0 && (
                    <p className="text-xs text-zinc-400">Serviço técnico: R$ {Number(os.valor_servico_tecnico).toFixed(2)}</p>
                  )}
                  <p className="text-sm font-semibold text-torque-400">
                    Valor total {os.status === 'finalizada' ? 'pago' : 'a receber'}: R$ {Number(os.valor_total || 0).toFixed(2)}
                  </p>

                  {os.status === 'aberta' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-500">Status:</span>
                        {Object.entries(STATUS_OPERACIONAL_LABELS).map(([valor, label]) => (
                          <button
                            key={valor}
                            onClick={() => handleMudarStatus(os, valor)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              (os.status_operacional || 'nao_iniciado') === valor
                                ? 'bg-torque-500 border-torque-500 text-graphite-950 font-semibold'
                                : 'border-graphite-600 text-zinc-400 hover:border-torque-500'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => abrirEdicao(os)}
                          className="flex items-center gap-1 text-xs border border-graphite-600 hover:border-torque-500 text-zinc-300 px-3 py-1.5 rounded-card"
                        >
                          <Pencil size={13} /> Editar OS
                        </button>

                        {os.status === 'aberta' && os.status_operacional === STATUS_OPERACIONAL.NAO_INICIADO && (
                          <button
                            onClick={() => handleRemoverOS(os)}
                            disabled={processandoId === os.id}
                            className="flex items-center gap-1 text-xs border border-gauge-600 hover:border-gauge-500 text-gauge-400 px-3 py-1.5 rounded-card disabled:opacity-50"
                          >
                            <Trash2 size={13} /> {processandoId === os.id ? 'Removendo...' : 'Remover OS'}
                          </button>
                        )}

                        {os.status_operacional === STATUS_OPERACIONAL.PRONTO_PAGAMENTO && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={pagamentoSelecionado[os.id] || ''}
                              onChange={(e) => setPagamentoSelecionado((p) => ({ ...p, [os.id]: e.target.value }))}
                              className="text-xs bg-graphite-900 border border-graphite-600 rounded-card px-2 py-2 text-zinc-200 focus:outline-none focus:border-torque-500"
                            >
                              <option value="">Forma de pagamento...</option>
                              {Object.entries(TAXAS_PAGAMENTO_LABELS).map(([valor, label]) => (
                                <option key={valor} value={valor}>{label}</option>
                              ))}
                            </select>
                            {(pagamentoSelecionado[os.id] === 'cartao_debito' || pagamentoSelecionado[os.id] === 'cartao_credito') && (
                              <select
                                value={pagamentoBandeira[os.id] || 'visa_mastercard'}
                                onChange={(e) => setPagamentoBandeira((p) => ({ ...p, [os.id]: e.target.value }))}
                                className="text-xs bg-graphite-900 border border-graphite-600 rounded-card px-2 py-2 text-zinc-200 focus:outline-none focus:border-torque-500"
                              >
                                {Object.entries(BANDEIRAS_LABELS).map(([valor, label]) => (
                                  <option key={valor} value={valor}>{label}</option>
                                ))}
                              </select>
                            )}
                            {pagamentoSelecionado[os.id] === 'cartao_credito' && (
                              <select
                                value={pagamentoParcelas[os.id] || 1}
                                onChange={(e) => setPagamentoParcelas((p) => ({ ...p, [os.id]: Number(e.target.value) }))}
                                className="text-xs bg-graphite-900 border border-graphite-600 rounded-card px-2 py-2 text-zinc-200 focus:outline-none focus:border-torque-500"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>{n}x</option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => handleFinalizar(os)}
                              disabled={processandoId === os.id}
                              className="flex items-center gap-2 bg-oil-500 hover:bg-oil-400 disabled:opacity-50 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card"
                            >
                              <FileText size={14} />
                              {processandoId === os.id ? 'Finalizando...' : 'Finalizar OS (gera PDF + WhatsApp)'}
                            </button>
                          </div>
                        )}
                      </div>
                      {os.status_operacional !== STATUS_OPERACIONAL.PRONTO_PAGAMENTO && (
                        <p className="text-xs bg-torque-500/10 border border-torque-500/30 text-torque-300 rounded-card px-3 py-2">
                          👆 Pra ir pro pagamento: clique em <strong>"Pronto — falta pagamento"</strong> ali em cima. Aí aparece o campo de forma de pagamento e o botão de finalizar.
                        </p>
                      )}
                    </div>
                  )}
                  {os.status === 'finalizada' && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xs text-oil-400 flex items-center gap-1"><MessageCircle size={12} /> Comprovante já enviado ao cliente</p>
                      <button
                        onClick={() => handleBaixarComprovante(os)}
                        className="flex items-center gap-1 text-xs border border-graphite-600 hover:border-torque-500 text-zinc-300 px-3 py-1.5 rounded-card"
                      >
                        <FileText size={13} /> Baixar comprovante (PDF)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {editandoId === os.id && edicao && (
                <div className="mt-3 space-y-3 bg-graphite-800 rounded-card p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <CampoEdicao
                      label="Nome do Cliente"
                      value={edicao.cliente_nome}
                      onChange={(v) => setEdicao((p) => ({ ...p, cliente_nome: v }))}
                    />
                    <CampoEdicao
                      label="Telefone do Cliente"
                      value={edicao.cliente_telefone}
                      onChange={(v) => setEdicao((p) => ({ ...p, cliente_telefone: v }))}
                    />
                    <CampoEdicao
                      label="Descrição do serviço"
                      value={edicao.descricao_servico}
                      onChange={(v) => setEdicao((p) => ({ ...p, descricao_servico: v }))}
                      full
                    />
                    <CampoEdicao
                      label="KM registrado"
                      value={edicao.km_registrado}
                      onChange={(v) => setEdicao((p) => ({ ...p, km_registrado: v }))}
                    />
                    <CampoEdicao
                      label="Valor do Serviço Técnico (R$)"
                      value={edicao.valor_servico_tecnico}
                      onChange={(v) => setEdicao((p) => ({ ...p, valor_servico_tecnico: v }))}
                    />
                    <CampoEdicao
                      label="Nome do Mecânico"
                      value={edicao.nome_mecanico}
                      onChange={(v) => setEdicao((p) => ({ ...p, nome_mecanico: v }))}
                    />
                    <CampoEdicao
                      label="Observação (ciência do cliente)"
                      value={edicao.observacao}
                      onChange={(v) => setEdicao((p) => ({ ...p, observacao: v }))}
                      full
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs uppercase text-zinc-500">Peças / Itens</label>
                      <button onClick={adicionarItemEdicao} className="flex items-center gap-1 text-xs text-torque-400 hover:text-torque-300">
                        <Plus size={14} /> Adicionar item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {edicao.itens.map((item, idx) => (
                        <div key={idx} className="bg-graphite-900 rounded-card p-2 space-y-2">
                          <div className="grid grid-cols-4 gap-2 items-end">
                            <MiniCampoEdicao label="Peça" className="col-span-2" value={item.nome_peca} onChange={(v) => atualizarItemEdicao(idx, 'nome_peca', v)} />
                            <MiniCampoEdicao label="Fornecedor" value={item.fornecedor} onChange={(v) => atualizarItemEdicao(idx, 'fornecedor', v)} />
                            <MiniCampoEdicao label="Qtd" type="number" value={item.quantidade} onChange={(v) => atualizarItemEdicao(idx, 'quantidade', v)} />
                          </div>
                          <div className="grid grid-cols-4 gap-2 items-end">
                            <MiniCampoEdicao label="Valor de compra" type="number" value={item.custo_unit} onChange={(v) => atualizarItemEdicao(idx, 'custo_unit', v)} />
                            <MiniCampoEdicao label="Valor de venda" type="number" value={item.preco_unit} onChange={(v) => atualizarItemEdicao(idx, 'preco_unit', v)} />
                            <MiniCampoEdicao label="Validade garantia" type="date" value={item.validade_garantia} onChange={(v) => atualizarItemEdicao(idx, 'validade_garantia', v)} />
                            <button onClick={() => removerItemEdicao(idx)} className="text-gauge-500 hover:text-red-400 justify-self-end mb-1.5">
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 bg-graphite-900 border border-graphite-600 rounded px-2 py-1.5">
                            <LinkIcon size={12} className="text-zinc-500 shrink-0" />
                            <input
                              value={item.garantia_peca_url || ''}
                              onChange={(e) => atualizarItemEdicao(idx, 'garantia_peca_url', e.target.value)}
                              placeholder="Cole aqui o link do comprovante (CamScanner, Google Drive, foto...)"
                              className="w-full bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => salvarEdicao(os)}
                      disabled={salvandoEdicao}
                      className="flex items-center gap-1 bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card"
                    >
                      <Check size={14} /> {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button
                      onClick={cancelarEdicao}
                      className="flex items-center gap-1 border border-graphite-600 text-zinc-400 hover:text-zinc-100 text-sm px-4 py-2 rounded-card"
                    >
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {veiculo && historico.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma OS encontrada para esta placa.</p>
        )}
      </div>

      {osParaEditar && (
        <EditarOSModal
          os={osParaEditar}
          onFechar={() => setOsParaEditar(null)}
          onSucesso={() => { setOsParaEditar(null); buscar(); }}
        />
      )}
    </div>
  );
}

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}

function CampoEdicao({ label, value, onChange, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-[10px] text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 bg-graphite-900 border border-graphite-600 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-torque-500"
      />
    </div>
  );
}

function MiniCampoEdicao({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="text-[10px] text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-graphite-800 border border-graphite-600 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-torque-500"
      />
    </div>
  );
}
