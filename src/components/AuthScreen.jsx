import React, { useState } from 'react';
import { LogIn, UserPlus, Wrench } from 'lucide-react';
import { loginUsuario, registrarUsuario } from '../firebase/services';
import { OFICINA_INFO } from '../config/oficina';

export default function AuthScreen() {
  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!email || !senha || (modo === 'registro' && !nome)) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setCarregando(true);
    try {
      if (modo === 'login') await loginUsuario(email.trim(), senha);
      else await registrarUsuario({ email: email.trim(), senha, nome: nome.trim() });
    } catch (err) {
      const mensagens = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/invalid-email': 'Informe um e-mail válido.',
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/configuration-not-found': 'O Firebase Authentication ainda não está habilitado/configurado no projeto.'
      };
      setErro(mensagens[err.code] || err.message || 'Não foi possível concluir a operação.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-graphite-900 border border-graphite-700 rounded-card p-7 shadow-2xl">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-torque-500 text-graphite-950 mb-3">
            <Wrench size={28} />
          </div>
          <h1 className="font-display text-3xl text-zinc-50 tracking-wide">{OFICINA_INFO.nome.toUpperCase()}</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestão da oficina</p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          {modo === 'registro' && <Campo label="Nome" value={nome} onChange={setNome} placeholder="Nome do usuário" />}
          <Campo label="E-mail" value={email} onChange={setEmail} placeholder="usuario@email.com" type="email" />
          <Campo label="Senha" value={senha} onChange={setSenha} placeholder="Mínimo de 6 caracteres" type="password" />
          {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-card p-3">{erro}</p>}
          <button disabled={carregando} className="w-full bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold py-3 rounded-card flex items-center justify-center gap-2">
            {modo === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setErro(''); }} className="w-full mt-4 text-sm text-zinc-400 hover:text-zinc-100">
          {modo === 'login' ? 'Ainda não possui acesso? Criar cadastro' : 'Já possui cadastro? Voltar para login'}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }) {
  return <label className="block">
    <span className="text-xs uppercase text-zinc-500">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full mt-1 bg-graphite-800 border border-graphite-600 rounded-card px-3 py-3 text-sm text-zinc-100 focus:outline-none focus:border-torque-500" />
  </label>;
}
