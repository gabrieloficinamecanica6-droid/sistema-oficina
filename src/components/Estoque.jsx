import React, { useEffect, useRef, useState } from 'react';
import { Package, Plus, Pencil, Trash2, X, Check, AlertTriangle, Star, Search } from 'lucide-react';
import { listarEstoque, salvarPecaEstoque, removerPecaEstoque } from '../firebase/services';

const VAZIO = {
  codigo: '', nome: '', marca: '', valor_compra: '', valor_venda: '', quantidade: '', modelo_veiculo: '', prioridade: false
};

export default function Estoque() {
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const modeloInputRef = useRef(null);

  useEffect(() => { carregar(); }, [busca]);

  async function carregar() {
    setCarregando(true);
    try { setPecas(await listarEstoque({ busca })); }
    finally { setCarregando(false); }
  }

  function iniciarEdicao(peca) {
    setEditandoId(peca.id);
    setForm({
      codigo: peca.codigo || '', nome: peca.nome || '', marca: peca.marca || '',
      valor_compra: peca.valor_compra ?? '', valor_venda: peca.valor_venda ?? '',
      quantidade: peca.quantidade ?? '', modelo_veiculo: peca.modelo_veiculo || '', prioridade: Boolean(peca.prioridade)
    });
    setTimeout(() => modeloInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  function cancelar() { setEditandoId(null); setForm(VAZIO); }

  async function salvar() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await salvarPecaEstoque({ id: editandoId, ...form });
      cancelar();
      await carregar();
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!confirm('Remover essa peça do estoque?')) return;
    await removerPecaEstoque(id);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-zinc-50 tracking-wide">ESTOQUE</h1>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, peça, marca ou modelo"
            className="w-full bg-graphite-800 border border-graphite-600 rounded-card pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500" />
        </div>
      </div>

      <section className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-4">
        <h2 className="text-sm uppercase text-zinc-500 mb-3">{editandoId ? 'Editar peça' : 'Adicionar peça'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <Campo label="Código" value={form.codigo} onChange={(v) => setForm(f => ({ ...f, codigo: v }))} />
          <div className="sm:col-span-2"><Campo label="Nome da peça" value={form.nome} onChange={(v) => setForm(f => ({ ...f, nome: v }))} placeholder="Ex: Filtro de Óleo" /></div>
          <Campo label="Marca" value={form.marca} onChange={(v) => setForm(f => ({ ...f, marca: v }))} />
          <Campo label="Carro / aplicação" value={form.modelo_veiculo} onChange={(v) => setForm(f => ({ ...f, modelo_veiculo: v }))} refEl={modeloInputRef} placeholder="Ex: Corsa, Celta" />
          <Campo label="Compra (R$)" type="number" value={form.valor_compra} onChange={(v) => setForm(f => ({ ...f, valor_compra: v }))} />
          <Campo label="Venda (R$)" type="number" value={form.valor_venda} onChange={(v) => setForm(f => ({ ...f, valor_venda: v }))} />
          <Campo label="Quantidade" type="number" value={form.quantidade} onChange={(v) => setForm(f => ({ ...f, quantidade: v }))} />
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer pb-2">
            <input type="checkbox" checked={form.prioridade} onChange={(e) => setForm(f => ({ ...f, prioridade: e.target.checked }))} className="accent-torque-500" />
            <Star size={15} className={form.prioridade ? 'fill-current text-torque-400' : 'text-zinc-500'} /> Prioridade
          </label>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={salvar} disabled={salvando || !form.nome.trim()} className="flex items-center gap-1 bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card">
            {editandoId ? <Check size={14} /> : <Plus size={14} />} {editandoId ? 'Salvar alterações' : 'Adicionar ao estoque'}
          </button>
          {editandoId && <button onClick={cancelar} className="flex items-center gap-1 border border-graphite-600 text-zinc-400 hover:text-zinc-100 text-sm px-4 py-2 rounded-card"><X size={14} /> Cancelar</button>}
        </div>
      </section>

      <section className="bg-graphite-900 border border-graphite-700 rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-zinc-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Prioridade</th><th className="text-left px-4 py-3">Código</th><th className="text-left px-4 py-3">Peça</th><th className="text-left px-4 py-3">Marca</th><th className="text-left px-4 py-3">Aplicação</th><th className="text-left px-4 py-3">Compra</th><th className="text-left px-4 py-3">Venda</th><th className="text-left px-4 py-3">Qtd.</th><th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && pecas.length === 0 && <tr><td colSpan={9} className="text-center text-zinc-500 py-6">Nenhuma peça encontrada.</td></tr>}
            {pecas.map((p) => (
              <tr key={p.id} className="border-t border-graphite-800">
                <td className="px-4 py-2">{p.prioridade ? <Star size={15} className="fill-current text-torque-400" /> : <span className="text-zinc-700">—</span>}</td>
                <td className="px-4 py-2 font-mono text-torque-300">{p.codigo || '—'}</td>
                <td className="px-4 py-2 text-zinc-100 flex items-center gap-2"><Package size={14} className="text-zinc-500" /> {p.nome}</td>
                <td className="px-4 py-2 text-zinc-400">{p.marca || '—'}</td>
                <td className="px-4 py-2 text-zinc-400">{p.modelo_veiculo || '—'}</td>
                <td className="px-4 py-2 text-zinc-400">R$ {Number(p.valor_compra || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-oil-400">R$ {Number(p.valor_venda || 0).toFixed(2)}</td>
                <td className={`px-4 py-2 font-medium ${Number(p.quantidade) <= 0 ? 'text-gauge-500' : 'text-zinc-200'}`}>{Number(p.quantidade) <= 0 && <AlertTriangle size={13} className="inline mr-1" />}{p.quantidade}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => iniciarEdicao(p)} className="text-zinc-400 hover:text-torque-400 p-1"><Pencil size={14} /></button><button onClick={() => excluir(p.id)} className="text-zinc-400 hover:text-gauge-500 p-1"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-zinc-500">A prioridade é apenas uma propriedade da peça. Ela não filtra nem esconde o restante do estoque.</p>
    </div>
  );
}

function Campo({ label, value, onChange, type = 'text', placeholder = '', refEl }) {
  return <div><label className="text-[10px] text-zinc-500">{label}</label><input ref={refEl} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full mt-0.5 bg-graphite-800 border border-graphite-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-torque-500" /></div>;
}
