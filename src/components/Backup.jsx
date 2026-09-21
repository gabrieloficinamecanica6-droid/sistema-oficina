import React, { useState } from 'react';
import { DownloadCloud, Info } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';

// Backup manual — funciona na hora, sem precisar publicar nada extra no
// Firebase. Baixa o banco inteiro (veículos, OS, financeiro, estoque, etc)
// como um arquivo JSON. Complementa (não substitui) o backup automático via
// Cloud Function descrito em functions/README.md, que roda sozinho toda semana
// depois de configurado.
export default function Backup() {
  const [baixando, setBaixando] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState(null);

  async function baixarBackup() {
    setBaixando(true);
    try {
      const snap = await get(ref(db, '/'));
      const dados = snap.exists() ? snap.val() : {};
      const conteudo = JSON.stringify(dados, null, 2);
      const blob = new Blob([conteudo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dataFormatada = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_oficina_${dataFormatada}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setUltimoBackup(new Date());
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-3xl text-zinc-50 tracking-wide">BACKUP</h1>

      <section className="ticket-edge bg-graphite-900 border border-graphite-700 rounded-card p-5 space-y-4">
        <div>
          <h2 className="text-sm uppercase text-zinc-500 mb-1">Backup manual (imediato)</h2>
          <p className="text-sm text-zinc-400">
            Baixa uma cópia completa de tudo — veículos, OS, financeiro, estoque — num arquivo
            (.json) pro seu computador. Guarde num Google Drive ou pasta segura.
          </p>
        </div>
        <button
          onClick={baixarBackup}
          disabled={baixando}
          className="flex items-center gap-2 bg-torque-500 hover:bg-torque-400 disabled:opacity-50 text-graphite-950 font-semibold text-sm px-4 py-2 rounded-card"
        >
          <DownloadCloud size={16} /> {baixando ? 'Gerando...' : 'Baixar backup agora'}
        </button>
        {ultimoBackup && (
          <p className="text-xs text-oil-400">Baixado às {ultimoBackup.toLocaleTimeString('pt-BR')}.</p>
        )}
      </section>

      <section className="bg-graphite-900/60 border border-graphite-700 rounded-card p-5 space-y-2">
        <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
          <Info size={15} className="text-torque-400" /> Backup automático semanal
        </div>
        <p className="text-sm text-zinc-400">
          O botão acima é manual — alguém precisa lembrar de clicar. Pra um backup que roda
          sozinho toda semana sem depender de ninguém, preparei o código de uma função na nuvem
          (Cloud Function) que faz isso automaticamente e guarda os arquivos no seu Storage do
          Firebase.
        </p>
        <p className="text-sm text-zinc-400">
          Ela não está ativa ainda — precisa ser publicada uma vez (passo a passo em{' '}
          <code className="text-torque-400">functions/README.md</code> no projeto). Isso exige
          colocar o plano do Firebase em "Blaze" (pré-pago, mas o custo dessa função é
          praticamente zero pro tamanho do seu banco).
        </p>
      </section>
    </div>
  );
}
