// IMPORTANTE (limitação real da Web API do WhatsApp):
// O link wa.me NÃO permite anexar um arquivo automaticamente — ele só abre
// uma conversa com um texto pré-preenchido. Não existe forma pública de
// "enviar o PDF junto" via URL.
//
// A ideia original era hospedar o PDF no Firebase Storage e mandar o link de
// download na mensagem — mas o Storage do Firebase hoje exige o plano pago
// (Blaze) mesmo pra uso básico, então tiramos essa dependência.
// Solução sem custo: o PDF já é baixado no computador (pdfDoc.save(), feito
// em HistoricoVeiculo.jsx antes de chamar esta função) — o WhatsApp abre com
// a mensagem pronta, e quem estiver operando só arrasta o arquivo já baixado
// pra dentro da conversa que abriu. Um clique a mais, mas funciona 100% grátis.
export function gerarLinkWhatsAppComPdf({ telefone, veiculo }) {
  const mensagem =
    `Olá, ${veiculo.cliente_nome || ''}! ` +
    `O atendimento do seu veículo ${veiculo.placa} foi finalizado. ` +
    `Segue o recibo em anexo com os itens e o valor total.`;

  const telefoneLimpo = (telefone || '').replace(/\D/g, '');
  const linkWhatsApp = `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;

  return { linkWhatsApp };
}

// Usado pelo alerta de "Revisões Pendentes" — mensagem ativa de fidelização.
export function gerarLinkWhatsAppRevisao({ telefone, cliente_nome, placa, dias_desde_ultima_troca }) {
  const mensagem =
    `Olá, ${cliente_nome || ''}! Notamos que já se passaram ${dias_desde_ultima_troca} dias ` +
    `desde a última troca de óleo do veículo ${placa}. Que tal agendar uma revisão? ` +
    `Responda esta mensagem para marcarmos um horário.`;

  const telefoneLimpo = (telefone || '').replace(/\D/g, '');
  return `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;
}
