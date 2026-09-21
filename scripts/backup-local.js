// Backup local automático — roda fora do navegador, direto no computador.
//
// Por que existe: o backup automático "de verdade" (que roda sozinho, sem
// ninguém clicar em nada) normalmente seria uma Cloud Function agendada, mas
// isso exige o plano pago (Blaze) do Firebase. Este script faz a mesma coisa
// sem custo nenhum: roda localmente (via Node, que vocês já têm instalado) e
// salva o arquivo numa pasta comum do computador. Se essa pasta for uma pasta
// sincronizada do Google Drive Desktop, o backup sobe pra nuvem sozinho,
// de graça, sem precisar escrever nenhuma integração com a API do Drive.
//
// Configuração necessária (uma vez só) — ver scripts/README.md.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const CAMINHO_CHAVE_SERVICO = path.join(__dirname, 'chave-servico-firebase.json');
const DATABASE_URL = 'https://oficina-f3fdb-default-rtdb.firebaseio.com';

// TROQUE AQUI pela pasta onde quer salvar os backups. Se apontar pra dentro
// da pasta do Google Drive Desktop (ex: "C:\Users\SeuNome\Google Drive\Backups"),
// o Drive sincroniza sozinho — é o "backup na nuvem" sem precisar de API paga.
const PASTA_DESTINO = path.join(__dirname, 'backups');

async function rodarBackup() {
  if (!fs.existsSync(CAMINHO_CHAVE_SERVICO)) {
    console.error('ERRO: não encontrei "chave-servico-firebase.json" dentro da pasta scripts/.');
    console.error('Veja o passo a passo em scripts/README.md pra gerar essa chave (é gratuito).');
    process.exitCode = 1;
    return;
  }

  const chaveServico = require(CAMINHO_CHAVE_SERVICO);

  admin.initializeApp({
    credential: admin.credential.cert(chaveServico),
    databaseURL: DATABASE_URL
  });

  console.log('Lendo o banco de dados...');
  const snapshot = await admin.database().ref('/').get();
  const dados = snapshot.exists() ? snapshot.val() : {};

  if (!fs.existsSync(PASTA_DESTINO)) {
    fs.mkdirSync(PASTA_DESTINO, { recursive: true });
  }

  const dataFormatada = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `backup_oficina_${dataFormatada}.json`;
  const caminhoCompleto = path.join(PASTA_DESTINO, nomeArquivo);

  fs.writeFileSync(caminhoCompleto, JSON.stringify(dados, null, 2), 'utf-8');
  console.log(`Backup salvo em: ${caminhoCompleto}`);

  process.exit(0);
}

rodarBackup().catch((erro) => {
  console.error('Falha ao gerar backup:', erro.message);
  process.exitCode = 1;
});
