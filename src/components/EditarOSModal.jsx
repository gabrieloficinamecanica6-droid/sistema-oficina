import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { atualizarOS, historicoDoVeiculo, listarClientes, buscarVeiculoPorPlaca, verificarCorreiaDentada } from '../firebase/services';

const ITEM_VAZIO = { codigo: '', nome_peca: '', fornecedor: '', quantidade: 1, preco_unit: 0, custo_unit: 0, validade_garantia: '', garantia_peca_url: '', do_estoque: false };

export default function EditarOSModal({ os, onFechar, onSucesso }) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [modelo, setModelo] = useState('');
  const [placa, setPlaca] = useState(os?.placa || '');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [valorServicoTecnico, setValorServicoTecnico] = useState('');
  const [nomeMecanico, setNomeMecanico] = useState('');
  const [observacao, setObservacao] = useState('');
  const [km, setKm] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [alertaCorreia, setAlertaCorreia] = useState(null);

  useEffect(() => {
    carregar();
  }, [os?.id, os?.placa]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [listaClientes, veiculo, historico] = await Promise.all([
        listarClientes(),
        buscarVeiculoPorPlaca(os.placa),
        historicoDoVeiculo(os.placa)
      ]);
      setClientes(listaClientes || []);
      const completo = (historico || []).find((item) => item.id === os.id) || os;
      const itensOs = Array.isArray(completo.itens) ? completo.itens : Object.values(completo.itens || {});
      setPlaca(os.placa || '');
      setDescricaoServico(completo.descricao_servico || '');
      setValorServicoTecnico(completo.valor_servico_tecnico ?? '');
      setNomeMecanico(completo.nome_mecanico || '');
      setObservacao(completo.observacao || '');
      setKm(completo.km_registrado || '');
      setItens(itensOs.length ? itensOs.map((i) => ({ ...ITEM_VAZIO, ...i, link_garantia: i.link_garantia || i.garantia_peca_url || '' })) : [{ ...ITEM_VAZIO }]);
      setModelo(veiculo?.modelo || '');

      let cliente = null;
      if (completo.cliente_id) cliente = (listaClientes || []).find((c) => c.id === completo.cliente_id);
      if (!cliente && veiculo?.cliente_id) cliente = (listaClientes || []).find((c) => c.id === veiculo.cliente_id);
      if (!cliente) cliente = (listaClientes || []).find((c) =>
        (veiculo?.cliente_nome && String(c.nome || '').trim().toLowerCase() === String(veiculo.cliente_nome).trim().toLowerCase()) ||
        (veiculo?.cliente_telefone && String(c.whatsapp || '').replace(/\D/g, '') === String(veiculo.cliente_telefone).replace(/\D/g, ''))
      );
      if (cliente) {
        setClienteId(cliente.id);
        setClienteNome(cliente.nome || '');
        setClienteTelefone(cliente.whatsapp || '');
        setClienteEmail(cliente.email || '');
      } else {
        setClienteNome(veiculo?.cliente_nome || completo.cliente_nome || '');
        setClienteTelefone(veiculo?.cliente_telefone || completo.cliente_telefone || '');
        setClienteEmail(veiculo?.cliente_email || completo.cliente_email || '');
      }
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar a OS.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!placa || !km) { setAlertaCorreia(null); return; }
    verificarCorreiaDentada(placa, km).then((r) => setAlertaCorreia(r && r.pendente ? r : null)).catch(() => setAlertaCorreia(null));
  }, [placa, km]);

  function selecionarCliente(id) {
    setClienteId(id);
    const c = clientes.find((item) => item.id === id);
    if (c) {
      setClienteNome(c.nome || '');
      setClienteTelefone(c.whatsapp || '');
      setClienteEmail(c.email || '');
    }
  }

  function atualizarItem(idx, campo, valor) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }
  function adicionarItem() { setItens((prev) => [...prev, { ...ITEM_VAZIO }]); }
  function removerItem(idx) { setItens((prev) => prev.filter((_, i) => i !== idx)); }

  async function salvar() {
    if (!placa || !descricaoServico) {
      setErro('Placa e descrição do serviço são obrigatórios.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const itensFinais = itens.map((item) => ({
        ...item,
        quantidade: Number(item.quantidade) || 0,
        preco_unit: Number(item.preco_unit) || 0,
        custo_unit: Number(item.custo_unit) || 0,
        garantia_peca_url: (item.link_garantia || item.garantia_peca_url || '').trim(),
        do_estoque: Boolean(item.do_estoque)
      }));
      await atualizarOS({
        placa: placa.toUpperCase(),
        idOs: os.id,
        descricao_servico: descricaoServico,
        km_registrado: km,
        itens: itensFinais,
        valor_servico_tecnico: valorServicoTecnico,
        nome_mecanico: nomeMecanico,
        observacao,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        cliente_email: clienteEmail,
        modelo
      });
      onSucesso();
    } catch (e) {
      setErro(e.message || 'Erro ao salvar a OS.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onMouseDown={onFechar}>
      <div className="bg-graphite-900 border border-graphite-700 rounded-card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-graphite-700 sticky top-0 bg-graphite-900 z-10">
          <div><h2 className="font-display text-2xl text-zinc-50">EDITAR ORDEM DE SERVIÇO</h2><p className="text-xs text-zinc-500">Mesma ficha usada para abrir a OS</p></div>
          <button onClick={onFechar} className="text-zinc-400 hover:text-zinc-100"><X size={20} /></button>
        </div>
        {carregando ? <div className="p-8 text-center text-zinc-400">Carregando dados da OS...</div> : (
          <div className="p-5 space-y-4">
            {erro && <p className="text-sm bg-gauge-500/10 border border-gauge-500/30 text-gauge-400 rounded-card px-3 py-2">{erro}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Placa" value={placa} onChange={setPlaca} uppercase />
              <Campo label="KM atual" value={km} onChange={setKm} />
              <div><label className="text-xs uppercase text-zinc-500">Cliente</label><select value={clienteId} onChange={(e) => selecionarCliente(e.target.value)} className="w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"><option value="">Selecionar cliente...</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.whatsapp ? ` — ${c.whatsapp}` : ''}</option>)}</select></div>
              <Campo label="Telefone (WhatsApp)" value={clienteTelefone} readOnly placeholder="Preenchido automaticamente" />
              <Campo label="E-mail" value={clienteEmail} readOnly placeholder="Preenchido automaticamente" />
              <Campo label="Modelo do veículo" value={modelo} onChange={setModelo} full />
            </div>
            {alertaCorreia && <p className="text-xs bg-gauge-500/10 border border-gauge-500/30 text-gauge-400 rounded-card px-3 py-2">⚠️ Esse carro já rodou <strong>{alertaCorreia.km_rodados.toLocaleString('pt-BR')} km</strong> desde a última troca de correia dentada (em {alertaCorreia.km_na_troca.toLocaleString('pt-BR')} km). Recomendado trocar a cada 40.000 km.</p>}
            <Campo label="Descrição do serviço" value={descricaoServico} onChange={setDescricaoServico} textarea />
            <div className="grid grid-cols-2 gap-3"><Campo label="Valor do Serviço Técnico (R$)" value={valorServicoTecnico} onChange={setValorServicoTecnico} /><Campo label="Nome do Mecânico" value={nomeMecanico} onChange={setNomeMecanico} /></div>
            <Campo label="Observação (ciência do cliente)" value={observacao} onChange={setObservacao} textarea />
            <div>
              <div className="flex items-center justify-between mb-2"><label className="text-xs uppercase text-zinc-500">Peças / Itens</label><button onClick={adicionarItem} className="flex items-center gap-1 text-xs text-torque-400 hover:text-torque-300"><Plus size={14}/> Adicionar item</button></div>
              <div className="space-y-3">{itens.map((item, idx) => <div key={idx} className="bg-graphite-800 rounded-card p-3 space-y-2">
                <div className="grid grid-cols-5 gap-2 items-end"><MiniCampo label="Código" value={item.codigo} onChange={(v) => atualizarItem(idx,'codigo',v)}/><MiniCampo label="Peça" className="col-span-2" value={item.nome_peca} onChange={(v) => atualizarItem(idx,'nome_peca',v)}/><MiniCampo label="Fornecedor" value={item.fornecedor} onChange={(v) => atualizarItem(idx,'fornecedor',v)}/><MiniCampo label="Qtd" type="number" value={item.quantidade} onChange={(v) => atualizarItem(idx,'quantidade',v)}/></div>
                <div className="grid grid-cols-4 gap-2 items-end"><MiniCampo label="Valor de compra (custo)" value={item.custo_unit} type="number" onChange={(v) => atualizarItem(idx,'custo_unit',v)}/><MiniCampo label="Valor de venda (unit.)" value={item.preco_unit} type="number" onChange={(v) => atualizarItem(idx,'preco_unit',v)}/><MiniCampo label="Validade garantia" type="date" value={item.validade_garantia} onChange={(v) => atualizarItem(idx,'validade_garantia',v)}/><button onClick={() => removerItem(idx)} className="text-gauge-500 hover:text-red-400 justify-self-end mb-1.5"><Trash2 size={16}/></button></div>
                <div className="flex items-center gap-1.5 bg-graphite-900 border border-graphite-600 rounded px-2 py-1.5"><LinkIcon size={12} className="text-zinc-500 shrink-0" /><input value={item.link_garantia || item.garantia_peca_url || ''} onChange={(e) => atualizarItem(idx,'link_garantia',e.target.value)} placeholder="Cole aqui o link do comprovante (CamScanner, Google Drive, foto...)" className="w-full bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder:text-zinc-600" /></div>
                <label className="text-[10px] text-zinc-400 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={Boolean(item.do_estoque)} onChange={(e) => atualizarItem(idx,'do_estoque',e.target.checked)} className="accent-torque-500" /> Peça do estoque (abate a quantidade automaticamente pelo nome)</label>
              </div>)}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={onFechar} className="border border-graphite-600 text-zinc-300 px-4 py-2 rounded-card">Cancelar</button><button onClick={salvar} disabled={salvando} className="bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold px-5 py-2 rounded-card">{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, textarea, readOnly, full, uppercase }) {
  const classe = `w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500 ${readOnly ? 'opacity-80' : ''} ${full ? 'col-span-2' : ''}`;
  return <div className={full ? 'col-span-2' : ''}><label className="text-xs uppercase text-zinc-500">{label}</label>{textarea ? <textarea value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly} className={`${classe} min-h-20 resize-y`} /> : <input value={value} onChange={(e) => onChange?.(uppercase ? e.target.value.toUpperCase() : e.target.value)} placeholder={placeholder} readOnly={readOnly} className={classe} />}</div>;
}
function MiniCampo({ label, value, onChange, type='text', className='' }) { return <div className={className}><label className="text-[10px] uppercase text-zinc-500">{label}</label><input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 bg-graphite-900 border border-graphite-600 rounded-card px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-torque-500"/></div>; }
