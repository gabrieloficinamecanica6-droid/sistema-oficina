import React, { useEffect, useState } from 'react';
import { Wrench, Gauge, Search, Wallet, Package, DownloadCloud, Users, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Dashboard from './components/Dashboard.jsx';
import HistoricoVeiculo from './components/HistoricoVeiculo.jsx';
import Financeiro from './components/Financeiro.jsx';
import Estoque from './components/Estoque.jsx';
import Backup from './components/Backup.jsx';
import Clientes from './components/Clientes.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import { auth } from './firebase/config';
import { OFICINA_INFO } from './config/oficina';

export default function App() {
  const [usuario, setUsuario] = useState(undefined);
  const [aba, setAba] = useState('dashboard');

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  if (usuario === undefined) return <div className="min-h-screen bg-graphite-950" />;
  if (!usuario) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-graphite-950 font-body">
      <header className="border-b border-graphite-700 bg-graphite-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Wrench className="text-torque-500" size={22} />
            <span className="font-display text-2xl tracking-wide text-zinc-50">{OFICINA_INFO.nome.toUpperCase()}</span>
          </div>
          <nav className="flex gap-1 flex-wrap justify-end">
            <BotaoAba ativo={aba === 'dashboard'} onClick={() => setAba('dashboard')} icon={Gauge} label="Painel" />
            <BotaoAba ativo={aba === 'historico'} onClick={() => setAba('historico')} icon={Search} label="Buscar Placa" />
            <BotaoAba ativo={aba === 'clientes'} onClick={() => setAba('clientes')} icon={Users} label="Clientes" />
            <BotaoAba ativo={aba === 'estoque'} onClick={() => setAba('estoque')} icon={Package} label="Estoque" />
            <BotaoAba ativo={aba === 'financeiro'} onClick={() => setAba('financeiro')} icon={Wallet} label="Financeiro" />
            <BotaoAba ativo={aba === 'backup'} onClick={() => setAba('backup')} icon={DownloadCloud} label="Backup" />
            <button onClick={() => signOut(auth)} title="Sair" className="p-2 rounded-card text-zinc-400 hover:text-red-400 hover:bg-graphite-800"><LogOut size={17}/></button>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {aba === 'dashboard' && <Dashboard />}
        {aba === 'historico' && <HistoricoVeiculo />}
        {aba === 'clientes' && <Clientes />}
        {aba === 'estoque' && <Estoque />}
        {aba === 'financeiro' && <Financeiro />}
        {aba === 'backup' && <Backup />}
      </main>
    </div>
  );
}

function BotaoAba({ ativo, onClick, icon: Icon, label }) {
  return <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium transition-colors ${ativo ? 'bg-torque-500 text-graphite-950' : 'text-zinc-400 hover:text-zinc-100 hover:bg-graphite-800'}`}><Icon size={16}/>{label}</button>;
}
