# Gabriel Oficina Mecânica — Sistema de Gestão

ERP local-first para oficina mecânica: React + Vite + Tailwind, PWA instalável, Firebase Realtime Database.

> **Nota:** este projeto foi migrado de Firestore para Realtime Database. O RTDB não tem persistência em disco no navegador como o Firestore tinha — ver seção "Decisões técnicas" abaixo antes de operar sem internet.

## Como rodar (desenvolvimento)

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Firebase
npm run dev
```

## Rodar como app de desktop (sem precisar abrir editor de código)

Isso resolve o "preciso abrir o VS Code toda vez": tem um atalho pronto que
faz tudo sozinho — inicia o sistema e já abre no navegador.

**Primeira vez (uma vez só):**
1. Abra a pasta do projeto (esta mesma pasta).
2. Dê 2 cliques em `Criar_Atalho_Area_Trabalho.vbs`.
3. Isso cria um atalho **"Gabriel Oficina Mecânica"** na Área de Trabalho, com a logo.

**Uso do dia a dia:** é só dar 2 cliques nesse atalho da Área de Trabalho.
Ele abre uma janela de servidor (título "NÃO FECHE — Servidor Gabriel
Oficina") e, alguns segundos depois, abre o navegador sozinho já na tela do
sistema. **Não feche essa janela de servidor** enquanto estiver usando o
sistema — é ela que mantém tudo rodando (pode minimizar, só não fechar).
Fechando ela, o sistema para de funcionar até abrir o atalho de novo.

Pra fechar tudo no fim do dia: feche a aba do navegador e feche a janela do
servidor.

> Isso continua rodando localmente (igual ao `npm run dev` que vocês já
> usavam, só que automático) — não publica o sistema na internet. Se um dia
> quiserem acessar de outro computador/celular na mesma rede, ou não depender
> mais desse computador estar ligado, dá pra publicar via Firebase Hosting
> (`firebase deploy --only hosting`) — é opcional, só avisar quando quiser.

## Build de produção manual (sem publicar)
```bash
npm run build
npm run preview
```

## Configurar o Firebase

1. Crie um projeto em console.firebase.google.com.
2. Ative **Realtime Database** (não confundir com Firestore — são produtos diferentes no menu lateral). Não precisa ativar Storage — o app não usa mais (ver seção "Decisões técnicas").
3. Copie as credenciais do app Web para `.env.local`, **incluindo a `databaseURL`** (aparece no topo da página do Realtime Database, ex: `https://SEU-PROJETO-default-rtdb.firebaseio.com`). Sem esse campo o `getDatabase()` falha.
4. Regras mínimas de Realtime Database para desenvolvimento: no Console → Realtime Database → **Regras**:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
   (exige login; se o app roda sem autenticação numa única máquina de bancada, me avise para ajustarmos a estratégia — regras totalmente abertas não são seguras para produção.)

### Estrutura de dados
O app já escreve automaticamente as coleções-espelho `os_ativas` (OS em andamento) e `revisoes` (última troca de óleo por veículo) — não precisa de Cloud Function nem de passo manual, isso foi resolvido diretamente em `abrirNovaOS`/`finalizarOS` dentro de `src/firebase/services.js`.

## Identidade visual
Cores extraídas diretamente da logo (`src/assets/logo.png`): vermelho da marca
(`torque`, botões/destaque/links) + grafite escuro (fundo) + laranja (`gauge`,
reservado pra alertas/perigo — estoque baixo, taxa de cartão, prejuízo) + verde
(`oil`, status "ok"). Editável em `tailwind.config.js`. Nome e logo usados no
app e nos PDFs vêm de `src/config/oficina.js` — troque ali se a marca mudar.

## Decisões técnicas (por quê)

- **jsPDF + jspdf-autotable** para os PDFs (recibo do cliente e relatório financeiro): roda 100% no navegador, leve, resolve bem tabelas sem precisar de html2canvas.
- **WhatsApp**: o link `wa.me` só pré-preenche texto — não existe forma pública de anexar arquivo automaticamente. O plano original era hospedar o PDF no Firebase Storage e mandar o link — mas o Storage hoje exige o plano pago (Blaze) do Firebase, então tiramos essa dependência. O PDF já é baixado localmente (`pdfDoc.save()`) antes do WhatsApp abrir; quem estiver operando arrasta o arquivo já baixado pra dentro da conversa. Um clique manual a mais, mas 100% grátis. O número da OS não aparece nem no PDF nem na mensagem — a placa já é suficiente pra achar o histórico no sistema.
- **Sem Firebase Storage**: comprovantes de garantia de peça (upload de PDF/foto) agora são guardados como texto (base64) direto no Realtime Database, não mais no Storage — mesmo motivo acima (Storage exige plano pago). Limite de 3MB por anexo (`LIMITE_TAMANHO_ANEXO` em `services.js`) pra não sobrecarregar o banco.
- **Backup automático semanal via Google Drive** (`scripts/`): como Cloud Functions agendadas também exigem o plano Blaze, o backup automático roda localmente — um script Node (`scripts/backup-local.js`) agendado pelo Agendador de Tarefas do Windows, salvando numa pasta sincronizada do Google Drive Desktop. Zero custo, zero API do Drive envolvida — é só sincronização de pasta. Passo a passo completo em `scripts/README.md`. O backup manual pela aba "Backup" do app continua existindo também, como opção rápida.
- **Despesas fixas e imprevistos**: aba Financeiro tem um formulário "Adicionar despesa" (aluguel, água, energia, ferramentas, imprevisto, outro) — lançamento manual de saída, sem vínculo com OS. Isso é o que faz o "Lucro do Mês" refletir o lucro real do negócio, não só o que entra/sai por atendimento. Categorias em `CATEGORIAS_DESPESA_LABELS`, em `services.js`.
- **Realtime Database em vez de Firestore**: escolha do usuário. Trade-off importante — **o RTDB não tem persistência em disco no navegador**. Diferente do Firestore (que usava `persistentLocalCache`), o RTDB só mantém em memória os dados que estão sob um listener ativo (`onValue`) enquanto a aba está aberta; fechar o app sem internet não garante que os dados fiquem disponíveis na reabertura. Se a internet da oficina for instável no dia a dia, vale considerar migrar para Firestore — é uma reescrita de `services.js`, não um ajuste pequeno.
- **Estoque**: reativado com tela própria (aba "Estoque"). Cadastra peça com nome, valor de compra e quantidade. Na abertura de OS, marcando o item como "Do estoque", o sistema abate a quantidade pelo nome (comparação sem diferenciar maiúscula/acento) assim que a OS é criada — se a peça não for encontrada ou o estoque ficar negativo, ele avisa mas não bloqueia a OS.
- **Taxa de forma de pagamento**: dinheiro/pix sem taxa; débito e crédito (à vista ou parcelado 2x-12x) com taxa por bandeira — `TAXAS_DEBITO` e `TAXAS_CREDITO` em `src/firebase/services.js`, valores reais tirados do app da maquininha do usuário (Visa/Mastercard e Elo). Seletor de bandeira aparece na finalização junto com forma de pagamento e parcelas.
- **Correia dentada (40.000km)**: não tem cadastro separado — ao preencher placa+KM no Novo Chamado, o sistema procura no histórico da placa a última OS com "correia dentada" nos itens e compara o KM. Mesma filosofia da troca de óleo (6 meses), mas por quilometragem em vez de tempo.
- **Observação / ciência do cliente**: campo livre na OS (abertura ou edição) pra registrar itens identificados que o cliente optou por não consertar (ex: amortecedor estourado). Aparece no PDF do cliente como registro por escrito, servindo de respaldo pra oficina.
- **Backup**: manual (aba "Backup", baixa um `.json` completo na hora) e automático semanal grátis via Google Drive (`scripts/`, ver `scripts/README.md` — não depende do plano pago do Firebase).

## Próximos passos sugeridos
- Autenticação (Firebase Auth) por funcionário, se mais de uma pessoa for operar o sistema — e para poder usar regras `.read`/`.write` restritas de verdade (hoje o Realtime Database está com regras abertas).
- Configurar o backup automático semanal (script pronto em `scripts/`, falta o passo a passo de 10 minutos — ver `scripts/README.md`).
