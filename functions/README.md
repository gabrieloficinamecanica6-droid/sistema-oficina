# Backup automático semanal — como ativar

Esse backup roda sozinho, sem precisar de ninguém clicar em nada. Mas precisa
ser publicado (deploy) uma vez só. São passos técnicos — se não se sentir
confortável, peça pra alguém de TI/dev fazer, ou me chame de novo que eu
oriento no detalhe.

## Pré-requisitos

1. Ter o [Node.js](https://nodejs.org) instalado no computador.
2. Colocar o projeto Firebase no **plano Blaze** (pré-pago). Isso é obrigatório
   pra usar Cloud Functions com agendamento — mas o custo real dessa função,
   rodando 1x por semana num banco pequeno, fica muito próximo de R$0 (o Google
   dá uma cota gratuita mensal generosa).
   - Console do Firebase → ⚙️ (Configurações do projeto) → Uso e faturamento → Modificar plano.

## Passo a passo

1. Instale a ferramenta de linha de comando do Firebase (uma vez só, no seu computador):
   ```
   npm install -g firebase-tools
   ```

2. Entre na pasta do projeto (a mesma que tem a pasta `functions/`) e faça login:
   ```
   firebase login
   ```

3. Se ainda não tiver, associe esse projeto ao Firebase (troque pelo ID do seu projeto):
   ```
   firebase use --add
   ```
   Escolha `oficina-f3fdb` quando aparecer a lista.

4. Instale as dependências da função:
   ```
   cd functions
   npm install
   cd ..
   ```

5. Publique só a função de backup:
   ```
   firebase deploy --only functions
   ```

Pronto — a partir daí, toda segunda-feira às 3h da manhã (horário de Brasília)
ela roda sozinha e salva um arquivo `backup_AAAA-MM-DD.json` dentro da pasta
`backups/` no Storage do seu projeto.

## Como ver/baixar os backups salvos

Console do Firebase → **Storage** → pasta `backups/` → clique no arquivo → **Baixar**.

## Se quiser mudar o dia/horário

Edite a linha `schedule: 'every monday 03:00'` em `functions/index.js` e rode
`firebase deploy --only functions` de novo. Formatos aceitos: `'every monday 03:00'`,
`'every day 04:00'`, ou uma expressão cron tipo `'0 3 * * 1'`.
