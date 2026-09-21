# Backup automático semanal — grátis, via Google Drive

Isso substitui a ideia anterior (Cloud Function do Firebase), que exigia o
plano pago. Esse jeito aqui roda local, no computador, e não custa nada.

Como funciona: um script roda (sozinho, agendado) e salva um arquivo com todo
o banco de dados numa pasta. Se essa pasta for uma pasta do **Google Drive
Desktop**, o Google sincroniza esse arquivo pra nuvem automaticamente — sem
precisar programar nenhuma integração com a API do Drive.

## Passo 1 — Gerar a chave de acesso ao banco (gratuito, uma vez só)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → projeto **oficina-f3fdb**.
2. Clique na ⚙️ (engrenagem, canto superior esquerdo) → **Configurações do projeto**.
3. Aba **Contas de serviço**.
4. Clique em **Gerar nova chave privada** → confirme. Um arquivo `.json` será baixado.
5. Renomeie esse arquivo para `chave-servico-firebase.json` e coloque dentro da pasta `scripts/` (a mesma pasta deste README).

⚠️ Esse arquivo dá acesso total ao banco — não compartilhe, não suba pro GitHub nem mande por WhatsApp. Só ele fica nesse computador.

## Passo 2 — Instalar o Google Drive Desktop (se ainda não tiver)

1. Baixe em [drive.google.com/drive/download](https://www.google.com/drive/download/).
2. Instale e faça login com a conta Google da oficina.
3. Isso cria uma pasta "Google Drive" no computador (geralmente em `C:\Users\SeuNome\Google Drive`) — qualquer coisa salva ali sincroniza sozinha pra nuvem.

## Passo 3 — Apontar o backup pra essa pasta

Abra `scripts/backup-local.js` num editor de texto e troque a linha:
```js
const PASTA_DESTINO = path.join(__dirname, 'backups');
```
por (ajuste o caminho pro seu usuário/pasta do Drive):
```js
const PASTA_DESTINO = 'C:\\Users\\SeuNome\\Google Drive\\Backups Oficina';
```

## Passo 4 — Instalar as dependências do script (uma vez só)

Abra o Prompt de Comando dentro da pasta `scripts/` e rode:
```
npm install
```

## Passo 5 — Testar

Dê 2 cliques em `Rodar_Backup.bat`. Deve aparecer "Backup salvo em: ..." e uma
janela ficará aberta esperando você apertar uma tecla (é só pra você conferir
que funcionou). Confira se o arquivo `.json` apareceu na pasta configurada, e
se ele aparece sincronizando no ícone do Google Drive.

## Passo 6 — Agendar pra rodar sozinho toda semana

1. Aperte a tecla Windows, digite **Agendador de Tarefas** (Task Scheduler) e abra.
2. **Ação → Criar Tarefa Básica**.
3. Nome: `Backup Oficina`.
4. Disparador: **Semanalmente**, escolha o dia e horário (ex: toda segunda, 3h da manhã — se o computador estiver ligado nesse horário).
5. Ação: **Iniciar um programa**.
6. Em "Programa/script", clique em **Procurar** e selecione `Rodar_Backup_Automatico.bat` (esse, não o outro — esse não trava esperando tecla).
7. Termine e salve.

Pronto — a partir daí roda sozinho, sem precisar abrir nada, e o backup
aparece automaticamente no Google Drive.

## Diferença entre os dois .bat
- `Rodar_Backup.bat` → uso manual, pra testar (mostra o resultado e espera você fechar).
- `Rodar_Backup_Automatico.bat` → uso pelo Agendador de Tarefas (roda e fecha sozinho, sem travar esperando ninguém).
