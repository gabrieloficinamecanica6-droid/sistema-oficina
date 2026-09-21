import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Biblioteca escolhida: jsPDF + jspdf-autotable.
// Motivo: 100% client-side (funciona offline, sem backend de renderização),
// leve (~250KB), e o autotable resolve muito bem a tabela de itens sem
// precisar de HTML->canvas (mais lento e pesado em tablets de bancada).

// Converte a URL/import de uma imagem (ex: logo importada via Vite) em base64,
// formato que o jsPDF precisa para desenhar a imagem no PDF. Assíncrono porque
// depende de carregar o arquivo (fetch) e ler os bytes (FileReader).
export async function carregarImagemComoBase64(url) {
  const resposta = await fetch(url);
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onloadend = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(blob);
  });
}

// PDF enviado ao CLIENTE — recibo limpo: nome/logo da oficina, o que foi feito
// no veículo (descrição do serviço + peças + serviço técnico, sem fornecedor)
// e o valor total. Informação de fornecedor/garantia fica só no app interno
// (aba "Buscar Placa"), não vai pro documento que o cliente recebe.
// É async por causa do carregamento da logo (se houver) — quem chamar precisa
// usar `await gerarPdfOS(...)`.
export async function gerarPdfOS({ veiculo, os, oficina }) {
  const docPdf = new jsPDF({ unit: 'mm', format: 'a4' });

  // Se uma logo foi configurada (src/config/oficina.js), desenha no canto
  // superior esquerdo e empurra o nome/endereço para o lado dela.
  let textoX = 14;
  if (oficina?.logoUrl) {
    try {
      const logoBase64 = await carregarImagemComoBase64(oficina.logoUrl);
      docPdf.addImage(logoBase64, 14, 10, 30, 20);
      textoX = 48;
    } catch (e) {
      // Se a logo falhar ao carregar, segue sem ela — não pode travar a emissão do recibo.
      console.warn('Não foi possível carregar a logo no PDF:', e);
    }
  }

  // Cabeçalho
  docPdf.setFontSize(16);
  docPdf.setFont('helvetica', 'bold');
  docPdf.text(oficina?.nome || 'Oficina Pro', textoX, 18);

  docPdf.setFontSize(10);
  docPdf.setFont('helvetica', 'normal');
  docPdf.text(oficina?.endereco || '', textoX, 24);
  docPdf.text(oficina?.telefone || '', textoX, 29);

  docPdf.setFontSize(12);
  docPdf.text(`Data: ${formatarData(os.finalizada_em)}`, 150, 18);

  docPdf.setDrawColor(200);
  docPdf.line(14, 37, 196, 37);

  // Dados do veículo
  docPdf.setFontSize(12);
  docPdf.setFont('helvetica', 'bold');
  docPdf.text('Veículo', 14, 45);
  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(10);
  docPdf.text(`Placa: ${veiculo.placa}`, 14, 51);
  docPdf.text(`Modelo: ${veiculo.marca || ''} ${veiculo.modelo || ''}`, 14, 56);
  docPdf.text(`Cliente: ${veiculo.cliente_nome || ''}`, 14, 61);
  docPdf.text(`KM na intervenção: ${os.km_registrado || '—'}`, 100, 51);
  docPdf.text(`Mecânico responsável: ${os.nome_mecanico || '—'}`, 100, 56);

  // O que foi feito no carro — descrição do serviço registrada na abertura da OS.
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(12);
  docPdf.text('Serviço realizado', 14, 71);
  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(10);
  const descricaoQuebrada = docPdf.splitTextToSize(os.descricao_servico || '—', 182);
  docPdf.text(descricaoQuebrada, 14, 77);

  let cursorY = 77 + descricaoQuebrada.length * 5 + 8;

  // Observação (ex: item identificado mas que o cliente optou por não
  // consertar agora) — fica registrada no recibo pra dar ciência por escrito
  // ao cliente, servindo de respaldo pra oficina.
  if (os.observacao) {
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(11);
    docPdf.text('Observação', 14, cursorY);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(9);
    const observacaoQuebrada = docPdf.splitTextToSize(os.observacao, 182);
    docPdf.text(observacaoQuebrada, 14, cursorY + 5);
    cursorY = cursorY + 5 + observacaoQuebrada.length * 4.5 + 8;
  }

  // Itens classificados: peças + serviço técnico, sem fornecedor.
  // Ex: "Pastilha — R$ 130,00" / "Serviço técnico — R$ 150,00"
  const linhasItens = (os.itens || []).map((i) => [
    i.nome_peca,
    `R$ ${(Number(i.preco_unit) * Number(i.quantidade)).toFixed(2)}`
  ]);
  if (Number(os.valor_servico_tecnico) > 0) {
    linhasItens.push(['Serviço técnico', `R$ ${Number(os.valor_servico_tecnico).toFixed(2)}`]);
  }

  autoTable(docPdf, {
    startY: cursorY,
    head: [['Item', 'Valor']],
    body: linhasItens,
    theme: 'grid',
    headStyles: { fillColor: [225, 4, 4] }, // vermelho da marca (mesmo tom da logo)
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } }
  });

  const finalY = docPdf.lastAutoTable.finalY + 10;

  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(13);
  docPdf.text(`Total: R$ ${Number(os.valor_total).toFixed(2)}`, 14, finalY);

  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(8);
  docPdf.text('Obrigado pela confiança!', 14, finalY + 10);

  return docPdf; // quem chamou decide: docPdf.save(...) ou docPdf.output('blob')
}

function formatarData(timestampOuData) {
  if (!timestampOuData) return '—';
  const data = timestampOuData.toDate ? timestampOuData.toDate() : new Date(timestampOuData);
  return data.toLocaleDateString('pt-BR');
}
