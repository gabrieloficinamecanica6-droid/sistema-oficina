import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { listarClientes, salvarCliente, removerCliente } from '../firebase/services';

const VAZIO = { nome: '', email: '', whatsapp: '', cpf: '', observacao: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [edicao, setEdicao] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  async function carregar() { setClientes(await listarClientes(busca)); }
  useEffect(() => { carregar(); }, [busca]);

  function novo() { setEdicao(VAZIO); setModal(true); }
  function editar(c) { setEdicao({ ...c }); setModal(true); }

  async function salvar(e) {
    e.preventDefault();
    if (!edicao.nome.trim()) return;
    setSalvando(true);
    try { await salvarCliente(edicao); setModal(false); await carregar(); }
    finally { setSalvando(false); }
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir o cadastro de ${c.nome}?\n\nOs históricos de OS não serão apagados.`)) return;
    await removerCliente(c.id);
    carregar();
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="font-display text-3xl text-zinc-50 tracking-wide">CLIENTES</h1><p className="text-sm text-zinc-500">Cadastro único para reutilizar nas OS.</p></div>
      <button onClick={novo} className="bg-torque-500 text-graphite-950 font-semibold px-4 py-2 rounded-card flex items-center gap-2"><Plus size={17}/> Novo cliente</button>
    </div>
    <div className="relative"><Search className="absolute left-3 top-3 text-zinc-500" size={17}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome, e-mail, WhatsApp ou CPF" className="w-full bg-graphite-800 border border-graphite-600 rounded-card pl-10 pr-3 py-3 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"/></div>
    <div className="bg-graphite-900 border border-graphite-700 rounded-card overflow-hidden">
      <table className="w-full text-sm"><thead className="bg-graphite-800 text-zinc-500"><tr><th className="text-left p-3">Nome</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">WhatsApp</th><th className="text-left p-3">CPF</th><th className="text-right p-3">Ações</th></tr></thead>
      <tbody>{clientes.map(c=><tr key={c.id} className="border-t border-graphite-700"><td className="p-3 text-zinc-100">{c.nome}</td><td className="p-3 text-zinc-300">{c.email || '—'}</td><td className="p-3 text-zinc-300">{c.whatsapp || '—'}</td><td className="p-3 text-zinc-400">{c.cpf || '—'}</td><td className="p-3"><div className="flex justify-end gap-2"><button onClick={()=>editar(c)} className="p-2 text-zinc-300 hover:text-white"><Pencil size={16}/></button><button onClick={()=>excluir(c)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>
      {!clientes.length && <div className="p-8 text-center text-zinc-500">Nenhum cliente encontrado.</div>}
    </div>
    {modal && <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"><form onSubmit={salvar} className="w-full max-w-lg bg-graphite-900 border border-graphite-700 rounded-card p-5 space-y-4">
      <div className="flex justify-between items-center"><h2 className="font-display text-2xl text-zinc-50">{edicao.id ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}</h2><button type="button" onClick={()=>setModal(false)}><X/></button></div>
      <Campo label="Nome *" value={edicao.nome} onChange={v=>setEdicao(p=>({...p,nome:v}))}/>
      <Campo label="E-mail" type="email" value={edicao.email} onChange={v=>setEdicao(p=>({...p,email:v}))}/><div className="grid grid-cols-2 gap-3"><Campo label="WhatsApp" value={edicao.whatsapp} onChange={v=>setEdicao(p=>({...p,whatsapp:v}))}/><Campo label="CPF" value={edicao.cpf} onChange={v=>setEdicao(p=>({...p,cpf:v}))}/></div>
      <Campo label="Observação" value={edicao.observacao} onChange={v=>setEdicao(p=>({...p,observacao:v}))}/>
      <button disabled={salvando} className="w-full bg-torque-500 text-graphite-950 font-semibold py-3 rounded-card">{salvando?'Salvando...':'Salvar cliente'}</button>
    </form></div>}
  </div>;
}
function Campo({label,value,onChange,type='text'}){return <label className="block"><span className="text-xs uppercase text-zinc-500">{label}</span><input type={type} value={value||''} onChange={e=>onChange(e.target.value)} className="w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-torque-500"/></label>}
