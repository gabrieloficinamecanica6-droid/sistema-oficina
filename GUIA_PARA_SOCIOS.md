# Sistema Gabriel Oficina Mecânica — o que o sistema faz

Resumo simples de tudo que o sistema tem hoje, sem termos técnicos.

O sistema funciona como um aplicativo de verdade: depois de instalado, abre
com um clique num ícone na área de trabalho, com a cores e a logo da oficina,
sem precisar abrir navegador nem programa de programação.

---

## 1. Painel Principal

Tela inicial — o que a equipe vê assim que abre o sistema.

- Todas as **ordens de serviço (OS) em aberto**: placa, cliente, **telefone
  clicável pra ligar direto**, serviço e status de andamento.
- Status simples de cada OS: **Não iniciado → Em andamento → Pronto (falta pagamento)**.
- Resumo do **lucro do mês**.
- Aviso de clientes que passaram de **6 meses sem trocar óleo**.
- Botão pra abrir uma nova OS.

## 2. Novo Chamado (abrir uma OS)

- Dados do cliente, veículo, placa, KM.
- Descrição do serviço, nome do **mecânico responsável**.
- Peças usadas: nome, fornecedor, quantidade, valor de compra e valor de venda.
- Se a peça está no **estoque**, uma caixinha marca isso e o sistema desconta sozinho.
- Anexo de comprovante de garantia.
- Campo de **Observação** — pra registrar por escrito quando o cliente foi
  avisado de um problema e optou por não consertar agora (ex: "amortecedor
  estourado, cliente ciente"). Isso fica registrado no recibo que o cliente recebe.
- **Aviso automático de correia dentada**: se o carro já passou de 40.000 km
  desde a última troca registrada, avisa na hora.

## 3. Buscar Placa (histórico do veículo)

- Todo o histórico de OS daquele carro.
- Dá pra **editar uma OS aberta** se algo foi digitado errado.
- Na hora de fechar: escolhe forma de pagamento (**Dinheiro, Pix, Débito ou
  Crédito**, com bandeira Visa/Mastercard ou Elo, e parcelamento de 1x a 12x
  no crédito).
- Gera o **recibo em PDF** automaticamente com a logo da oficina e abre o
  WhatsApp já com a mensagem pronta — só falta clicar em enviar.
- **Comprovante pode ser baixado de novo a qualquer momento**, mesmo depois
  de finalizado.

## 4. Estoque

- Cadastro de peças: nome, valor de compra, quantidade.
- Abate sozinho quando a peça é usada numa OS marcada como "do estoque".
- Avisa mas não trava o atendimento se algo não bater.

## 5. Financeiro

- Entradas, saídas e lucro do mês, navegando mês a mês.
- Lista detalhada de cada lançamento — qual carro, qual forma de pagamento —
  justificando o número final.
- Taxas reais da maquininha já descontam do lucro automaticamente.
- Botão pra **exportar em PDF** o relatório do mês.

## 6. Backup

- Botão de **backup manual** — baixa uma cópia completa dos dados na hora.
- Backup **automático semanal** (precisa ser ativado uma vez só, é técnico —
  ver `functions/README.md` no projeto ou pedir ajuda).

## 7. Avisos automáticos

- **Troca de óleo**: mais de 6 meses desde a última.
- **Correia dentada**: mais de 40.000 km desde a última.

---

## O que ainda não tem (pontos em aberto)

- **Login/senha por funcionário**: hoje quem tem o link/app instalado acessa
  tudo, sem usuário separado.
- **Backup automático** precisa ser ativado (o manual já funciona).

---

*Documento atualizado junto com o desenvolvimento do sistema — reflete o
estado atual. Qualquer parte pode mudar, é só avisar.*
