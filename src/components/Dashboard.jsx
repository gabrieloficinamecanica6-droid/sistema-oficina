import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Bell, Plus, MessageCircle, Phone, ClipboardList, Wrench, CreditCard, Package } from 'lucide-react';
import {
  ouvirOSAtivas,
  obterResumoDashboard,
  listarRevisoesPendentes,
  atualizarStatusOperacional,
  STATUS_OPERACIONAL_LABELS
} from '../firebase/services';
import { gerarLinkWhatsAppRevisao } from '../utils/whatsapp';
import NovoChamadoModal from './NovoChamadoModal.jsx';
import EditarOSModal from './EditarOSModal.jsx';

// Não usamos spinner de tela cheia: o listener em tempo real (ouvirOSAtivas)
// preenche a tabela assim que os dados chegam do RTDB, e o estado inicial
// vazio some naturalmente com o primeiro callback do onValue.
export default function Dashboard() {
  const [osAtivas, setOsAtivas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [revisoesPendentes, setRevisoesPendentes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [osEditando, setOsEditando] = useState(null);

  async function carregarAlertas() {
    const [dados, revisoes] = await Promise.all([
      obterResumoDashboard(),
      listarRevisoesPendentes()
    ]);
    setResumo(dados);
    setRevisoesPendentes(revisoes);
  }

  useEffect(() => {
    carregarAlertas();
    // Listener em tempo real: assim que uma OS é aberta, muda de status ou é
    // finalizada em qualquer lugar do app, essa lista se atualiza sozinha —
    // não depende de recarregar a página nem de "sucesso" do modal.
    const unsubscribe = ouvirOSAtivas(setOsAtivas);
    return () => unsubscribe();
  }, []);

  async function handleMudarStatus(idOs, novoStatus) {
    const os = osAtivas.find((o) => o.id === idOs || o.id_os === idOs);
    if (!os) return;
    await atualizarStatusOperacional(os.placa, idOs, novoStatus);
    // Não precisa atualizar estado manualmente — o listener onValue já traz a mudança.
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-zinc-50 tracking-wide">PAINEL DA BANCADA</h1>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-torque-500 hover:bg-torque-400 text-graphite-950 font-semibold px-4 py-2 rounded-card transition-colors"
        >
          <Plus size={18} /> Novo Chamado
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardAlerta icon={ClipboardList} cor="text-torque-400" titulo="OS abertas" valor={resumo?.os_abertas ?? '—'} detalhe="Atendimentos ativos" />
        <CardAlerta icon={Wrench} cor="text-torque-400" titulo="Em processo" valor={resumo?.os_em_processo ?? '—'} detalhe="Serviços em execução" />
        <CardAlerta icon={CreditCard} cor="text-oil-400" titulo="Aguardando pagamento" valor={resumo?.os_aguardando_pagamento ?? '—'} detalhe="Prontas para fechar" />
        <CardAlerta icon={Bell} cor="text-torque-400" titulo="Revisões pendentes" valor={revisoesPendentes.length} detalhe="Óleo > 6 meses" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardAlerta icon={TrendingUp} cor="text-oil-400" titulo="Entradas" valor={resumo ? `R$ ${resumo.entradas.toFixed(2)}` : '—'} detalhe="Resultado financeiro do mês" />
        <CardAlerta icon={TrendingDown} cor="text-gauge-400" titulo="Saídas" valor={resumo ? `R$ ${resumo.saidas.toFixed(2)}` : '—'} detalhe="Despesas e custos registrados" />
        <CardAlerta icon={TrendingUp} cor={resumo && resumo.lucro < 0 ? 'text-gauge-400' : 'text-oil-400'} titulo="Lucro" valor={resumo ? `R$ ${resumo.lucro.toFixed(2)}` : '—'} detalhe="Entradas menos saídas" />
      </div>

      {resumo?.alertas_estoque?.length > 0 && (
        <section className="bg-graphite-900 border border-graphite-700 rounded-card p-4">
          <h2 className="font-display text-xl text-zinc-100 mb-3 flex items-center gap-2"><Package size={18} className="text-torque-400" /> ALERTAS DE ESTOQUE</h2>
          <div className="space-y-2">
            {resumo.alertas_estoque.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-graphite-800 rounded-card px-3 py-2">
                <div><p className="text-sm text-zinc-100 font-medium">⭐ {p.nome}</p><p className="text-xs text-zinc-400">Estoque: {p.quantidade} · PRIORIDADE — REPOSIÇÃO NECESSÁRIA</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {revisoesPendentes.length > 0 && (
        <section className="bg-graphite-900 border border-graphite-700 rounded-card p-4">
          <h2 className="font-display text-xl text-zinc-100 mb-3">REVISÕES PENDENTES</h2>
          <div className="space-y-2">
            {revisoesPendentes.map((r) => (
              <div key={r.placa} className="flex items-center justify-between bg-graphite-800 rounded-card px-3 py-2">
                <div>
                  <p className="text-sm text-zinc-100 font-medium">{r.placa} — {r.cliente_nome}</p>
                  <p className="text-xs text-zinc-400">Última troca há {r.dias_desde_ultima_troca} dias</p>
                </div>
                <a
                  href={gerarLinkWhatsAppRevisao(r)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs bg-oil-500 hover:bg-oil-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-card"
                >
                  <MessageCircle size={14} /> WhatsApp Ativo
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-graphite-900 border border-graphite-700 rounded-card overflow-hidden">
        <h2 className="font-display text-xl text-zinc-100 px-4 pt-4">ORDENS DE SERVIÇO ATIVAS</h2>
        <table className="w-full text-sm mt-3">
          <thead className="text-zinc-500 text-xs uppercase border-t border-graphite-700">
            <tr>
              <th className="text-left px-4 py-2">Placa</th>
              <th className="text-left px-4 py-2">Cliente</th>
              <th className="text-left px-4 py-2">Telefone</th>
              <th className="text-left px-4 py-2">Serviço</th>
              <th className="text-left px-4 py-2">Aberta em</th>
              <th className="text-left px-4 py-2">Lucro previsto</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {osAtivas.length === 0 && (
              <tr><td colSpan={8} className="text-center text-zinc-500 py-6">Nenhuma OS ativa no momento.</td></tr>
            )}
            {osAtivas.map((os) => (
              <tr key={os.id} className="border-t border-graphite-800 hover:bg-graphite-800/60 cursor-pointer">
                <td className="px-4 py-2 font-mono text-torque-300">{os.placa}</td>
                <td className="px-4 py-2">{os.cliente_nome}</td>
                <td className="px-4 py-2">
                  {os.cliente_telefone ? (
                    <a
                      href={`tel:${os.cliente_telefone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-oil-400 hover:text-oil-300"
                    >
                      <Phone size={13} /> {os.cliente_telefone}
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-400">{os.descricao_servico}</td>
                <td className="px-4 py-2 text-zinc-400">{formatarData(os.aberta_em)}</td>
                <td className={`px-4 py-2 font-medium ${(os.lucro_previsto || 0) >= 0 ? 'text-oil-400' : 'text-gauge-500'}`}>
                  R$ {(os.lucro_previsto || 0).toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <SeletorStatus
                    valor={os.status_operacional || 'nao_iniciado'}
                    onChange={(novo) => handleMudarStatus(os.id || os.id_os, novo)}
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => setOsEditando(os)}
                    className="text-xs border border-graphite-600 hover:border-torque-500 text-zinc-300 hover:text-zinc-100 px-3 py-1.5 rounded-card"
                  >
                    Editar OS
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {osEditando && (
        <EditarOSModal
          os={osEditando}
          onFechar={() => setOsEditando(null)}
          onSucesso={() => { setOsEditando(null); carregarAlertas(); }}
        />
      )}

      {modalAberto && (
        <NovoChamadoModal
          onFechar={() => setModalAberto(false)}
          onSucesso={() => { setModalAberto(false); carregarAlertas(); }}
        />
      )}
    </div>
  );
}

const CORES_STATUS = {
  nao_iniciado: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  em_andamento: 'bg-torque-500/20 text-torque-400 border-torque-500/40',
  pronto_pagamento: 'bg-oil-500/20 text-oil-400 border-oil-500/40'
};

function SeletorStatus({ valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-medium px-2 py-1 rounded-full border bg-transparent focus:outline-none cursor-pointer ${CORES_STATUS[valor] || CORES_STATUS.nao_iniciado}`}
    >
      {Object.entries(STATUS_OPERACIONAL_LABELS).map(([valorOpcao, label]) => (
        <option key={valorOpcao} value={valorOpcao} className="bg-graphite-800 text-zinc-100">
          {label}
        </option>
      ))}
    </select>
  );
}

function CardAlerta({ icon: Icon, cor, titulo, valor, detalhe }) {
  return (
    <div className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4 pb-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className={cor} />
        <span className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</span>
      </div>
      <p className="font-display text-3xl text-zinc-50">{valor}</p>
      <p className="text-xs text-zinc-500 mt-1 truncate">{detalhe}</p>
    </div>
  );
}

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
