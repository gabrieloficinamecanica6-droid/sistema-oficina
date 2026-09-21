import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { abrirNovaOS, verificarCorreiaDentada, listarClientes, buscarVeiculoPorPlaca } from '../firebase/services';

const ITEM_VAZIO = { codigo: '', nome_peca: '', fornecedor: '', quantidade: 1, preco_unit: 0, custo_unit: 0, validade_garantia: '', link_garantia: '', do_estoque: false };

export default function NovoChamadoModal({ onFechar, onSucesso }) {
  const [placa, setPlaca] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [modelo, setModelo] = useState('');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [valorServicoTecnico, setValorServicoTecnico] = useState('');
  const [nomeMecanico, setNomeMecanico] = useState('');
  const [observacao, setObservacao] = useState('');
  const [km, setKm] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [alertaCorreia, setAlertaCorreia] = useState(null);

  useEffect(() => { listarClientes().then(setClientes).catch(() => {}); }, []);

  function selecionarCliente(id) {
    setClienteId(id);
    const c = clientes.find((item) => item.id === id);
    if (c) { setClienteNome(c.nome || ''); setClienteTelefone(c.whatsapp || ''); setClienteEmail(c.email || ''); }
  }

  async function carregarClienteDaPlaca(placaAtual) {
    const placaNormalizada = String(placaAtual || '').trim().toUpperCase();
    if (!placaNormalizada) return;
    try {
      const veiculo = await buscarVeiculoPorPlaca(placaNormalizada);
      if (!veiculo) return;
      if (veiculo.modelo && !modelo) setModelo(veiculo.modelo);
      if (veiculo.cliente_id) {
        const cliente = clientes.find((c) => c.id === veiculo.cliente_id);
        if (cliente) { selecionarCliente(cliente.id); return; }
      }
      // Compatibilidade com veículos antigos que ainda só possuem nome/telefone.
      const clienteAntigo = clientes.find((c) =>
        (veiculo.cliente_nome && String(c.nome || '').trim().toLowerCase() === String(veiculo.cliente_nome).trim().toLowerCase()) ||
        (veiculo.cliente_telefone && String(c.whatsapp || '').replace(/\D/g, '') === String(veiculo.cliente_telefone).replace(/\D/g, ''))
      );
      if (clienteAntigo) selecionarCliente(clienteAntigo.id);
    } catch {
      // Placa nova ou consulta indisponível: mantém o fluxo normal.
    }
  }

  async function checarCorreia(placaAtual, kmAtual) {
    if (!placaAtual || !kmAtual) {
      setAlertaCorreia(null);
      return;
    }
    try {
      const resultado = await verificarCorreiaDentada(placaAtual, kmAtual);
      setAlertaCorreia(resultado && resultado.pendente ? resultado : null);
    } catch {
      // Não trava o fluxo se a checagem falhar (ex: placa nova, sem histórico)
      setAlertaCorreia(null);
    }
  }

  function atualizarItem(idx, campo, valor) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { ...ITEM_VAZIO }]);
  }

  function removerItem(idx) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  async function salvar() {
    if (!placa || !descricaoServico) {
      setErro('Placa e descrição do serviço são obrigatórios.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const placaUpper = placa.toUpperCase();

      const itensFinais = itens.map((item) => ({
        codigo: (item.codigo || '').trim(),
        nome_peca: item.nome_peca,
        fornecedor: item.fornecedor,
        quantidade: Number(item.quantidade),
        preco_unit: Number(item.preco_unit),
        custo_unit: Number(item.custo_unit),
        validade_garantia: item.validade_garantia,
        garantia_peca_url: (item.link_garantia || '').trim(),
        do_estoque: Boolean(item.do_estoque)
      }));

      const resultado = await abrirNovaOS({
        placa: placaUpper,
        veiculoDados: { cliente_id: clienteId || '', cliente_nome: clienteNome, cliente_telefone: clienteTelefone, modelo, km_atual: Number(km) || 0 },
        descricao_servico: descricaoServico,
        km_registrado: km,
        itens: itensFinais,
        valor_servico_tecnico: valorServicoTecnico,
        nome_mecanico: nomeMecanico,
        observacao
      });

      if (resultado?.avisosEstoque?.length) {
        alert('Atenção no estoque:\n' + resultado.avisosEstoque.join('\n'));
      }
      onSucesso();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar chamado.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-center justify-center p-4">
      <div
        className="bg-graphite-900 border border-graphite-700 rounded-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-graphite-700 sticky top-0 bg-graphite-900">
          <h2 className="font-display text-2xl text-zinc-50">NOVO CHAMADO</h2>
          <button onClick={onFechar} className="text-zinc-400 hover:text-zinc-100"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Placa" value={placa} onChange={setPlaca} onBlur={() => { carregarClienteDaPlaca(placa); checarCorreia(placa, km); }} placeholder="ABC1D23" uppercase />
            <Campo label="KM atual" value={km} onChange={setKm} onBlur={() => checarCorreia(placa, km)} placeholder="85000" />
            <div>
              <label className="text-xs uppercase text-zinc-500">Cliente</label>
              <select value={clienteId} onChange={(e) => selecionarCliente(e.target.value)} className="w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500">
                <option value="">Selecionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.whatsapp ? ` — ${c.whatsapp}` : ''}</option>)}
              </select>
            </div>
            <Campo label="Telefone (WhatsApp)" value={clienteTelefone} onChange={setClienteTelefone} placeholder="Selecione o cliente" readOnly />
            <Campo label="E-mail" value={clienteEmail} onChange={setClienteEmail} placeholder="Preenchido automaticamente pelo cadastro" />
            <Campo label="Modelo do veículo" value={modelo} onChange={setModelo} placeholder="Onix 1.0" full />
          </div>

          {alertaCorreia && (
            <p className="text-xs bg-gauge-500/10 border border-gauge-500/30 text-gauge-400 rounded-card px-3 py-2">
              ⚠️ Esse carro já rodou <strong>{alertaCorreia.km_rodados.toLocaleString('pt-BR')} km</strong> desde a última troca de correia dentada (em {alertaCorreia.km_na_troca.toLocaleString('pt-BR')} km). Recomendado trocar a cada 40.000 km.
            </p>
          )}

          <Campo label="Descrição do serviço" value={descricaoServico} onChange={setDescricaoServico} placeholder="Troca de óleo + revisão de freios" textarea />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor do Serviço Técnico (R$)" value={valorServicoTecnico} onChange={setValorServicoTecnico} placeholder="150" />
            <Campo label="Nome do Mecânico" value={nomeMecanico} onChange={setNomeMecanico} placeholder="Ex: João" />
          </div>
          <Campo
            label="Observação (ciência do cliente)"
            value={observacao}
            onChange={setObservacao}
            placeholder="Ex: amortecedor dianteiro estourado — cliente ciente, optou por não trocar agora"
            textarea
            full
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase text-zinc-500">Peças / Itens</label>
              <button onClick={adicionarItem} className="flex items-center gap-1 text-xs text-torque-400 hover:text-torque-300">
                <Plus size={14} /> Adicionar item
              </button>
            </div>
            <div className="space-y-3">
              {itens.map((item, idx) => (
                <div key={idx} className="bg-graphite-800 rounded-card p-3 space-y-2">
                  <div className="grid grid-cols-5 gap-2 items-end">
                    <MiniCampo label="Código" value={item.codigo} onChange={(v) => atualizarItem(idx, 'codigo', v)} />
                    <MiniCampo label="Peça" className="col-span-2" value={item.nome_peca} onChange={(v) => atualizarItem(idx, 'nome_peca', v)} />
                    <MiniCampo label="Fornecedor" value={item.fornecedor} onChange={(v) => atualizarItem(idx, 'fornecedor', v)} />
                    <MiniCampo label="Qtd" type="number" value={item.quantidade} onChange={(v) => atualizarItem(idx, 'quantidade', v)} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 items-end">
                    <MiniCampo label="Valor de compra (custo)" value={item.custo_unit} type="number" onChange={(v) => atualizarItem(idx, 'custo_unit', v)} />
                    <MiniCampo label="Valor de venda (unit.)" value={item.preco_unit} type="number" onChange={(v) => atualizarItem(idx, 'preco_unit', v)} />
                    <MiniCampo label="Validade garantia" type="date" value={item.validade_garantia} onChange={(v) => atualizarItem(idx, 'validade_garantia', v)} />
                    <button onClick={() => removerItem(idx)} className="text-gauge-500 hover:text-red-400 justify-self-end mb-1.5">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 bg-graphite-900 border border-graphite-600 rounded px-2 py-1.5">
                    <LinkIcon size={12} className="text-zinc-500 shrink-0" />
                    <input
                      value={item.link_garantia}
                      onChange={(e) => atualizarItem(idx, 'link_garantia', e.target.value)}
                      placeholder="Cole aqui o link do comprovante (CamScanner, Google Drive, foto...)"
                      className="w-full bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  <label className="text-[10px] text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.do_estoque}
                      onChange={(e) => atualizarItem(idx, 'do_estoque', e.target.checked)}
                      className="accent-torque-500"
                    />
                    Peça do estoque (abate a quantidade automaticamente pelo nome)
                  </label>
                </div>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-gauge-500">{erro}</p>}

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold py-3 rounded-card"
          >
            {salvando ? 'Salvando...' : 'Abrir OS'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, onBlur, placeholder, uppercase, textarea, full, readOnly }) {
  const Componente = textarea ? 'textarea' : 'input';
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-xs uppercase text-zinc-500">{label}</label>
      <Componente
        value={value}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={textarea ? 2 : undefined}
        className="w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"
      />
    </div>
  );
}

function MiniCampo({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="text-[10px] text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-graphite-900 border border-graphite-600 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-torque-500"
      />
    </div>
  );
}
