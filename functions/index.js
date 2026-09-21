const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

// Roda toda segunda-feira às 03:00 (horário de São Paulo) — de madrugada,
// pra não competir com o uso normal do sistema. Lê o banco inteiro e salva
// um arquivo .json com data no Storage, dentro da pasta "backups/".
exports.backupSemanal = onSchedule(
  {
    schedule: 'every monday 03:00',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1'
  },
  async () => {
    const db = getDatabase();
    const snap = await db.ref('/').get();
    const dados = snap.exists() ? snap.val() : {};

    const dataFormatada = new Date().toISOString().slice(0, 10);
    const nomeArquivo = `backups/backup_${dataFormatada}.json`;

    const bucket = getStorage().bucket();
    const arquivo = bucket.file(nomeArquivo);
    await arquivo.save(JSON.stringify(dados, null, 2), {
      contentType: 'application/json'
    });

    console.log(`Backup semanal salvo em: ${nomeArquivo}`);
  }
);
