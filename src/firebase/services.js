import {
  ref, push, set, update, get, remove, serverTimestamp, onValue
} from 'firebase/database';
import { db } from './config';

// Etapas do fluxo operacional de uma OS, ANTES de "finalizada" (que segue
// significando "pago e entregue"). Isso é o que aparece como "status" na
// página inicial: não iniciado -> em andamento -> pronto (aguardando pagamento).
export const STATUS_OPERACIONAL = {
  NAO_INICIADO: 'nao_iniciado',
  EM_ANDAMENTO: 'em_andamento',
  PRONTO_PAGAMENTO: 'pronto_pagamento'
};

export const STATUS_OPERACIONAL_LABELS = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  pronto_pagamento: 'Pronto — falta pagamento'
};

/*
  ESQUEMA DE DADOS (Realtime Database — árvore JSON)
  ---------------------------------------------------
  veiculos/{placa}/dados
    - placa, modelo, marca, ano, cliente_nome, cliente_telefone, km_atual

  veiculos/{placa}/ordens_servico/{id_os}
    - status: 'aberta' | 'finalizada'
    - status_operacional: 'nao_iniciado' | 'em_andamento' | 'pronto_pagamento'
    - descricao_servico, km_registrado, nome_mecanico, observacao
    - itens: { idItem: {...} }  (objeto, não array — padrão RTDB)
    - valor_pecas, custo_pecas, lucro_previsto (estimados na abertura/edição)
    - valor_servico_tecnico, valor_total, custo_total, lucro (reais, na finalização)
    - tipo_pagamento, parcelas, bandeira, taxa_percentual, valor_taxa (só após finalizada)
    - aberta_em, finalizada_em (timestamps numéricos via serverTimestamp)
    - contem_troca_oleo: boolean

  os_ativas/{id_os}        <-- espelho p/ o Dashboard (evita varrer todos os veículos)
    - id_os, placa, cliente_nome, cliente_telefone, descricao_servico,
      nome_mecanico, status_operacional, lucro_previsto, aberta_em

  revisoes/{placa}         <-- 1 registro por veículo, sobrescrito a cada troca de óleo
    - placa, cliente_nome, telefone, ultima_troca_em, km_na_troca

  financeiro/{id_lancamento}
    - tipo: 'entrada' | 'saida', categoria, valor, tipo_pagamento, parcelas,
      bandeira, descricao, id_os, placa, data

  estoque/{id_produto}
    - nome, nome_normalizado, valor_compra, quantidade
*/

const LIMITE_DIAS_REVISAO = 180; // 6 meses

// ---------- ESTOQUE ----------
// Normaliza texto pra comparar nomes de peça sem depender de maiúscula/acento
// exatos (ex: "Filtro de Óleo" e "filtro de oleo" batem igual).
export function normalizarNome(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


// Compatibilidade: o Firebase pode devolver timestamps como number, string,
// Date ou objetos com toDate(). O restante do sistema trabalha sempre com ms.
export function normalizarTimestamp(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date ? d.getTime() : new Date(d).getTime();
  }
  if (typeof valor === 'object' && typeof valor.seconds === 'number') {
    return valor.seconds * 1000 + Math.floor((valor.nanoseconds || 0) / 1e6);
  }
  const n = Number(valor);
  if (Number.isFinite(n) && String(valor).trim() !== '') return n;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function normalizarStatusOS(status) {
  const s = String(status || '').toLowerCase().trim();
  if (['finalizada', 'finalizado', 'fechada', 'fechado', 'closed'].includes(s)) return 'fechada';
  if (['pronto_pagamento', 'pronto-pagamento', 'aguardando_pagamento', 'aguardando pagamento', 'ready_payment'].includes(s)) return 'aguardando_pagamento';
  if (['em_andamento', 'em andamento', 'em_processo', 'em processo', 'in_progress'].includes(s)) return 'em_processo';
  return 'nao_iniciada';
}

export function normalizarOS(id, os) {
  const raw = os || {};
  const itens = raw.itens
    ? (Array.isArray(raw.itens) ? raw.itens : Object.entries(raw.itens).map(([itemId, item]) => ({ id_item: itemId, ...item })))
    : [];
  const statusOperacional = raw.status_operacional || raw.status_operacao || null;
  const status = raw.status || (statusOperacional ? 'aberta' : 'aberta');
  return {
    id,
    ...raw,
    itens,
    status,
    status_operacional: raw.status_operacional || ({
      nao_iniciado: 'nao_iniciado', nao_iniciado: 'nao_iniciado',
      em_andamento: 'em_andamento', em_processo: 'em_andamento',
      pronto_pagamento: 'pronto_pagamento', aguardando_pagamento: 'pronto_pagamento'
    }[String(raw.status || '').toLowerCase()] || raw.status_operacional),
    status_normalizado: normalizarStatusOS(raw.status_operacional || raw.status),
    aberta_em: normalizarTimestamp(raw.aberta_em || raw.criada_em || raw.data),
    finalizada_em: normalizarTimestamp(raw.finalizada_em || raw.fechada_em),
    placa: String(raw.placa || '').toUpperCase(),
    cliente_nome: raw.cliente_nome || raw.cliente || '',
    cliente_telefone: raw.cliente_telefone || raw.telefone || raw.whatsapp || ''
  };
}

export async function listarEstoque({ busca = '', prioridade = null } = {}) {
  const snap = await get(ref(db, 'estoque'));
  if (!snap.exists()) return [];
  const termo = normalizarNome(busca);
  return Object.entries(snap.val())
    .map(([id, p]) => ({ id, ...p, prioridade: Boolean(p.prioridade) }))
    .filter((p) => {
      if (prioridade === true && !p.prioridade) return false;
      if (!termo) return true;
      return [p.codigo, p.nome, p.marca, p.modelo_veiculo]
        .map(normalizarNome)
        .some((v) => v.includes(termo));
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade ? -1 : 1;
      return String(a.nome || '').localeCompare(String(b.nome || ''));
    });
}

// Cria (sem id) ou atualiza (com id) uma peça do estoque.
export async function salvarPecaEstoque({ id, codigo, nome, marca, valor_compra, valor_venda, quantidade, modelo_veiculo, prioridade }) {
  const dados = {
    ...(codigo !== undefined ? { codigo: String(codigo || '').trim() } : {}),
    nome: String(nome || '').trim(),
    nome_normalizado: normalizarNome(nome),
    ...(marca !== undefined ? { marca: String(marca || '').trim() } : {}),
    valor_compra: Number(valor_compra) || 0,
    valor_venda: Number(valor_venda) || 0,
    quantidade: Number(quantidade) || 0,
    ...(modelo_veiculo !== undefined ? { modelo_veiculo: String(modelo_veiculo || '').trim() } : {}),
    ...(prioridade !== undefined ? { prioridade: Boolean(prioridade) } : {})
  };
  if (id) {
    await update(ref(db, `estoque/${id}`), dados);
    return id;
  }
  const novaRef = push(ref(db, 'estoque'));
  await set(novaRef, dados);
  return novaRef.key;
}

export async function removerPecaEstoque(id) {
  await remove(ref(db, `estoque/${id}`));
}

// Procura no estoque uma peça com nome igual (normalizado) e abate a
// quantidade usada. Não bloqueia a OS se o estoque ficar negativo — só avisa,
// porque travar o atendimento por causa de uma divergência de estoque
// atrapalha mais do que ajuda. Retorna info pra o chamador decidir se avisa o usuário.
export async function abaterEstoque({ codigo, nome, quantidadeUsada }) {
  const qtd = Number(quantidadeUsada) || 0;
  if (qtd <= 0) return { encontrada: false };
  const snap = await get(ref(db, 'estoque'));
  if (!snap.exists()) return { encontrada: false };

  const alvoCodigo = String(codigo || '').trim().toLowerCase();
  const alvoNome = normalizarNome(nome);
  const entradas = Object.entries(snap.val());
  const match = entradas.find(([, p]) => {
    if (alvoCodigo && String(p.codigo || '').trim().toLowerCase() === alvoCodigo) return true;
    return alvoNome && (p.nome_normalizado || normalizarNome(p.nome)) === alvoNome;
  });
  if (!match) return { encontrada: false };

  const [id, peca] = match;
  const quantidadeAnterior = Number(peca.quantidade) || 0;
  const restante = quantidadeAnterior - qtd;
  await update(ref(db, `estoque/${id}`), { quantidade: restante });
  return { encontrada: true, id, quantidadeAnterior, restante, insuficiente: restante < 0 };
}

export async function abaterEstoquePorNome(nomePeca, quantidadeUsada) {
  return abaterEstoque({ nome: nomePeca, quantidadeUsada });
}

export async function devolverEstoque({ estoqueId, codigo, nome, quantidade }) {
  const qtd = Number(quantidade) || 0;
  if (qtd <= 0) return { encontrada: false };
  if (estoqueId) {
    const snap = await get(ref(db, `estoque/${estoqueId}`));
    if (snap.exists()) {
      const atual = Number(snap.val().quantidade) || 0;
      await update(ref(db, `estoque/${estoqueId}`), { quantidade: atual + qtd });
      return { encontrada: true, id: estoqueId, quantidade: atual + qtd };
    }
  }
  const alvo = await abaterEstoque({ codigo, nome, quantidadeUsada: -qtd });
  if (alvo.encontrada) return { encontrada: true, id: alvo.id, quantidade: alvo.restante };
  return { encontrada: false };
}


// ---------- VEÍCULOS ----------

export async function buscarVeiculoPorPlaca(placa) {
  const snap = await get(ref(db, `veiculos/${placa.toUpperCase()}/dados`));
  return snap.exists() ? snap.val() : null;
}

export async function criarOuAtualizarVeiculo(dados) {
  const placa = dados.placa.toUpperCase();
  // update() no RTDB cria o caminho automaticamente se ele não existir —
  // não precisa do try/catch que o Firestore exigia.
  await update(ref(db, `veiculos/${placa}/dados`), { ...dados, placa });
  return placa;
}

export async function historicoDoVeiculo(placa) {
  const placaUpper = String(placa || '').toUpperCase().trim();
  const resultados = new Map();

  const snapAtual = await get(ref(db, `veiculos/${placaUpper}/ordens_servico`));
  if (snapAtual.exists()) {
    Object.entries(snapAtual.val()).forEach(([id, os]) => resultados.set(id, normalizarOS(id, { ...os, placa: os.placa || placaUpper })));
  }

  // Compatibilidade somente de leitura: se o sistema antigo mantiver OS em
  // /ordens, aproveitamos as que pertencem à placa sem alterar essa estrutura.
  const legado = await get(ref(db, 'ordens'));
  if (legado.exists()) {
    Object.entries(legado.val()).forEach(([id, os]) => {
      const osPlaca = String(os?.placa || os?.placa_veiculo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const alvo = placaUpper.replace(/[^A-Z0-9]/g, '');
      if (osPlaca === alvo && !resultados.has(id)) resultados.set(id, normalizarOS(id, os));
    });
  }

  return [...resultados.values()].sort((a, b) => b.aberta_em - a.aberta_em);
}

// ---------- CORREIA DENTADA (troca a cada 40.000km) ----------
// Ao contrário da troca de óleo (baseada em tempo), a correia dentada é
// baseada em quilometragem. Em vez de manter um nó separado pra isso, olha
// direto no histórico da placa: acha a última OS que teve "correia dentada"
// nos itens e compara o KM registrado nela com o KM atual informado.
const LIMITE_KM_CORREIA = 40000;

export async function verificarCorreiaDentada(placa, kmAtual) {
  const historico = await historicoDoVeiculo(placa);
  const ultimaComCorreia = historico.find((os) =>
    (os.itens || []).some((i) => (i.nome_peca || '').toLowerCase().includes('correia dentada'))
  );
  if (!ultimaComCorreia) return null;

  const kmNaTroca = Number(ultimaComCorreia.km_registrado) || 0;
  const kmRodados = Number(kmAtual) - kmNaTroca;
  return {
    km_na_troca: kmNaTroca,
    km_rodados: kmRodados,
    pendente: kmRodados >= LIMITE_KM_CORREIA
  };
}

// ---------- NOVO CHAMADO / ABERTURA DE OS ----------

export async function abrirNovaOS({ placa, veiculoDados, descricao_servico, km_registrado, itens, valor_servico_tecnico, nome_mecanico, observacao }) {
  const placaUpper = placa.toUpperCase();
  await criarOuAtualizarVeiculo({ placa: placaUpper, ...veiculoDados, ...(veiculoDados.cliente_id ? { cliente_id: veiculoDados.cliente_id } : {}) });

  const osRef = push(ref(db, `veiculos/${placaUpper}/ordens_servico`));
  const idOs = osRef.key;
  const osPath = `veiculos/${placaUpper}/ordens_servico/${idOs}`;

  const contemTrocaOleo = itens.some((i) =>
    i.nome_peca.toLowerCase().includes('óleo') || i.nome_peca.toLowerCase().includes('oleo')
  );
  const valorServico = Number(valor_servico_tecnico) || 0;
  const valor_pecas = itens.reduce((acc, i) => acc + i.preco_unit * i.quantidade, 0);
  const custo_pecas = itens.reduce((acc, i) => acc + (i.custo_unit || 0) * i.quantidade, 0);
  // Serviço técnico é receita pura (sem custo de peça associado), então entra
  // direto no lucro previsto.
  const lucro_previsto = valor_pecas - custo_pecas + valorServico;

  // itens vira objeto (id_item -> item) porque o RTDB não lida bem com
  // arrays grandes/edições parciais — cada peça ganha uma chave própria.
  const itensObj = {};
  itens.forEach((item, i) => {
    itensObj[`item_${i}`] = {
      ...item,
      quantidade: Number(item.quantidade) || 0,
      preco_unit: Number(item.preco_unit) || 0,
      custo_unit: Number(item.custo_unit) || 0,
      do_estoque: Boolean(item.do_estoque),
      retirado_estoque: false
    };
  });

  const novaOS = {
    status: 'aberta',
    status_operacional: STATUS_OPERACIONAL.NAO_INICIADO,
    descricao_servico,
    km_registrado: Number(km_registrado) || 0,
    nome_mecanico: nome_mecanico || '',
    observacao: observacao || '',
    itens: itensObj,
    valor_pecas,
    custo_pecas,
    lucro_previsto,
    valor_servico_tecnico: valorServico,
    valor_total: valor_pecas + valorServico,
    contem_troca_oleo: contemTrocaOleo,
    aberta_em: serverTimestamp(),
    finalizada_em: null
  };

  await set(osRef, novaOS);

  // O desconto do estoque acontece dentro da mesma operação lógica da criação
  // da OS. Guardamos o id da peça e a quantidade retirada para que uma OS
  // cancelada possa devolver exatamente o que foi retirado.
  const avisosEstoque = [];
  for (const [itemKey, item] of Object.entries(itensObj)) {
    if (!item.do_estoque) continue;
    const resultado = await abaterEstoque({
      codigo: item.codigo,
      nome: item.nome_peca,
      quantidadeUsada: item.quantidade
    });
    if (!resultado.encontrada) {
      avisosEstoque.push(`\"${item.nome_peca}\" não foi encontrada no estoque.`);
      continue;
    }
    await update(ref(db, `${osPath}/${itemKey}`), {
      retirado_estoque: true,
      estoque_id: resultado.id,
      estoque_quantidade_retirada: Number(item.quantidade) || 0
    });
    if (resultado.insuficiente) {
      avisosEstoque.push(`Estoque de \"${item.nome_peca}\" ficou negativo (${resultado.restante}).`);
    }
  }

  // Mantém o espelho os_ativas em sincronia — é dele que o Dashboard lê.
  await set(ref(db, `os_ativas/${idOs}`), {
    id: idOs,
    id_os: idOs,
    placa: placaUpper,
    cliente_id: veiculoDados.cliente_id || '',
    cliente_nome: veiculoDados.cliente_nome || '',
    cliente_telefone: veiculoDados.cliente_telefone || '',
    descricao_servico,
    nome_mecanico: nome_mecanico || '',
    status_operacional: STATUS_OPERACIONAL.NAO_INICIADO,
    lucro_previsto,
    aberta_em: serverTimestamp()
  });

  return { idOs, avisosEstoque };
}

// ---------- FORMAS DE PAGAMENTO E TAXAS ----------
// Taxas reais tiradas direto do app da maquininha ("Detalhes das taxas",
// plano de recebimento na hora). A maquininha mostra em faixas — 1x (à vista)
// e 2x a 12x (parcelado, taxa única pra faixa toda) — não uma taxa diferente
// pra cada parcela, então seguimos o mesmo formato aqui.
export const TAXAS_DEBITO = {
  visa_mastercard: 1.19,
  elo: 1.99
};

export const TAXAS_CREDITO = {
  visa_mastercard: { avista: 3.50, parcelado: 2.30 },
  elo: { avista: 4.50, parcelado: 4.99 }
};

export const BANDEIRAS_LABELS = {
  visa_mastercard: 'Visa / Mastercard',
  elo: 'Elo'
};

export const TAXAS_PAGAMENTO_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de Débito',
  cartao_credito: 'Cartão de Crédito'
};

// Retorna a taxa (%) aplicável pra uma forma de pagamento + parcelas + bandeira.
function obterTaxaPercentual(tipo_pagamento, parcelas, bandeira) {
  const bandeiraFinal = bandeira && TAXAS_DEBITO[bandeira] !== undefined ? bandeira : 'visa_mastercard';
  if (tipo_pagamento === 'cartao_debito') return TAXAS_DEBITO[bandeiraFinal];
  if (tipo_pagamento === 'cartao_credito') {
    const p = Math.min(Math.max(Number(parcelas) || 1, 1), 12);
    return p === 1 ? TAXAS_CREDITO[bandeiraFinal].avista : TAXAS_CREDITO[bandeiraFinal].parcelado;
  }
  return 0; // dinheiro / pix
}

// ---------- FINALIZAR OS ----------
export async function finalizarOS({ placa, idOs, itens, valor_servico_tecnico, tipo_pagamento, parcelas, bandeira }) {
  const placaUpper = placa.toUpperCase();
  const osPath = `veiculos/${placaUpper}/ordens_servico/${idOs}`;
  const osSnap = await get(ref(db, osPath));
  if (!osSnap.exists()) throw new Error('OS não encontrada.');
  const osAtual = osSnap.val();

  const custo_total = itens.reduce((acc, i) => acc + (i.custo_unit || 0) * i.quantidade, 0);
  const valor_pecas = itens.reduce((acc, i) => acc + i.preco_unit * i.quantidade, 0);
  const valorServico = Number(valor_servico_tecnico ?? osAtual.valor_servico_tecnico ?? 0);
  const valor_total = valor_pecas + valorServico;

  // Parcelas só fazem sentido no crédito — limitado a 12x (o limite pedido).
  const parcelasFinal = tipo_pagamento === 'cartao_credito' ? Math.min(Math.max(Number(parcelas) || 1, 1), 12) : null;
  const bandeiraFinal = (tipo_pagamento === 'cartao_debito' || tipo_pagamento === 'cartao_credito') ? (bandeira || 'visa_mastercard') : null;

  const taxa_percentual = obterTaxaPercentual(tipo_pagamento, parcelasFinal, bandeiraFinal);
  const valor_taxa = valor_total * (taxa_percentual / 100);
  const lucro = valor_total - custo_total - valor_taxa;

  const itensObj = {};
  itens.forEach((item, i) => { itensObj[`item_${i}`] = item; });

  await update(ref(db, osPath), {
    status: 'finalizada',
    itens: itensObj,
    valor_pecas,
    valor_servico_tecnico: valorServico,
    valor_total,
    custo_total,
    tipo_pagamento,
    parcelas: parcelasFinal,
    bandeira: bandeiraFinal,
    taxa_percentual,
    valor_taxa,
    lucro,
    finalizada_em: serverTimestamp()
  });

  // Sai da lista de ativos
  await remove(ref(db, `os_ativas/${idOs}`));

  // Se teve troca de óleo, atualiza (sobrescreve) o registro de revisão do veículo
  if (osAtual.contem_troca_oleo) {
    const veiculoSnap = await get(ref(db, `veiculos/${placaUpper}/dados`));
    const veiculo = veiculoSnap.val() || {};
    await set(ref(db, `revisoes/${placaUpper}`), {
      placa: placaUpper,
      cliente_nome: veiculo.cliente_nome || '',
      telefone: veiculo.cliente_telefone || '',
      ultima_troca_em: serverTimestamp(),
      km_na_troca: osAtual.km_registrado || 0
    });
  }

  const sufixoParcelas = parcelasFinal && parcelasFinal > 1 ? ` em ${parcelasFinal}x` : '';
  const sufixoBandeira = bandeiraFinal ? ` (${BANDEIRAS_LABELS[bandeiraFinal]})` : '';

  // Um único lançamento visível no financeiro: o resultado líquido da OS.
  // Custo e taxa ficam gravados como metadados da OS e do lançamento, mas não
  // poluem a lista financeira com vários lançamentos para o mesmo atendimento.
  await push(ref(db, 'financeiro'), {
    tipo: 'entrada',
    categoria: 'OS',
    valor: lucro,
    valor_bruto_os: valor_total,
    custo_pecas: custo_total,
    taxa_cartao: valor_taxa,
    tipo_pagamento,
    parcelas: parcelasFinal,
    bandeira: bandeiraFinal,
    descricao: `OS ${idOs} — ${placaUpper}`,
    id_os: idOs,
    placa: placaUpper,
    data: serverTimestamp()
  });

  return { valor_total, custo_total, valor_taxa, taxa_percentual, lucro, finalizada_em: Date.now() };
}

// ---------- EDITAR OS ABERTA ----------
// Permite corrigir descrição, KM, itens e valor de serviço técnico de uma OS
// que ainda não foi finalizada. Recalcula os totais do zero a partir dos itens
// recebidos (mesma lógica de abrirNovaOS) e mantém o espelho em os_ativas
// sincronizado, já que o Dashboard lê de lá.
export async function atualizarOS({ placa, idOs, descricao_servico, km_registrado, itens, valor_servico_tecnico, nome_mecanico, observacao, cliente_id, cliente_nome, cliente_telefone, cliente_email, modelo }) {
  const placaUpper = placa.toUpperCase();
  const osPath = `veiculos/${placaUpper}/ordens_servico/${idOs}`;
  const osSnap = await get(ref(db, osPath));
  if (!osSnap.exists()) throw new Error('OS não encontrada.');
  const osAtual = osSnap.val();
  if (osAtual.status !== 'aberta') {
    throw new Error('Só é possível editar uma OS que ainda não foi finalizada.');
  }

  // Cliente às vezes chega, deixa o carro, e o nome/telefone só ficam
  // completos depois — dá pra preencher isso aqui, na edição da OS, sem
  // precisar recriar nada. Atualiza direto no cadastro do veículo (dados),
  // que é onde essa informação mora de verdade.
  if (cliente_id !== undefined || cliente_nome !== undefined || cliente_telefone !== undefined || cliente_email !== undefined || modelo !== undefined) {
    await criarOuAtualizarVeiculo({
      placa: placaUpper,
      ...(cliente_id !== undefined ? { cliente_id } : {}),
      ...(cliente_nome !== undefined ? { cliente_nome } : {}),
      ...(cliente_telefone !== undefined ? { cliente_telefone } : {}),
      ...(cliente_email !== undefined ? { cliente_email } : {}),
      ...(modelo !== undefined ? { modelo } : {})
    });
  }

  const contemTrocaOleo = itens.some((i) =>
    i.nome_peca.toLowerCase().includes('óleo') || i.nome_peca.toLowerCase().includes('oleo')
  );
  const valorServico = Number(valor_servico_tecnico) || 0;
  const valor_pecas = itens.reduce((acc, i) => acc + Number(i.preco_unit) * Number(i.quantidade), 0);
  const custo_pecas = itens.reduce((acc, i) => acc + (Number(i.custo_unit) || 0) * Number(i.quantidade), 0);
  const lucro_previsto = valor_pecas - custo_pecas + valorServico;

  const itensAntigos = Array.isArray(osAtual.itens)
    ? osAtual.itens
    : Object.values(osAtual.itens || {});
  const itensObj = {};
  itens.forEach((item, i) => {
    itensObj[`item_${i}`] = { ...item, quantidade: Number(item.quantidade) || 0 };
  });

  // Sincroniza somente as movimentações de estoque controladas pelo sistema.
  // OS antigas sem a marca retirado_estoque não são alteradas.
  for (const antigo of itensAntigos) {
    if (!antigo.retirado_estoque) continue;
    const novo = itens.find((item) =>
      (antigo.estoque_id && item.estoque_id === antigo.estoque_id) ||
      (antigo.codigo && item.codigo && String(antigo.codigo).toLowerCase() === String(item.codigo).toLowerCase()) ||
      (!antigo.codigo && !item.codigo && normalizarNome(antigo.nome_peca) === normalizarNome(item.nome_peca))
    );
    if (!novo) {
      await devolverEstoque({ estoqueId: antigo.estoque_id, codigo: antigo.codigo, nome: antigo.nome_peca, quantidade: antigo.quantidade });
      continue;
    }
    const diferenca = (Number(novo.quantidade) || 0) - (Number(antigo.quantidade) || 0);
    if (diferenca > 0) {
      const r = await abaterEstoque({ codigo: novo.codigo, nome: novo.nome_peca, quantidadeUsada: diferenca });
      if (r.encontrada) {
        novo.retirado_estoque = true;
        novo.estoque_id = r.id;
      }
    } else if (diferenca < 0) {
      await devolverEstoque({ estoqueId: antigo.estoque_id, codigo: antigo.codigo, nome: antigo.nome_peca, quantidade: Math.abs(diferenca) });
    }
    novo.retirado_estoque = true;
    novo.estoque_id = antigo.estoque_id || novo.estoque_id;
  }

  for (const novo of itens) {
    if (!novo.do_estoque || novo.retirado_estoque) continue;
    const r = await abaterEstoque({ codigo: novo.codigo, nome: novo.nome_peca, quantidadeUsada: novo.quantidade });
    if (r.encontrada) {
      novo.retirado_estoque = true;
      novo.estoque_id = r.id;
    }
  }

  itens.forEach((item, i) => { itensObj[`item_${i}`] = { ...item, quantidade: Number(item.quantidade) || 0 }; });

  await update(ref(db, osPath), {
    descricao_servico,
    km_registrado: Number(km_registrado) || 0,
    nome_mecanico: nome_mecanico || '',
    observacao: observacao || '',
    itens: itensObj,
    valor_pecas,
    custo_pecas,
    lucro_previsto,
    valor_servico_tecnico: valorServico,
    valor_total: valor_pecas + valorServico,
    contem_troca_oleo: contemTrocaOleo,
    ...(cliente_id !== undefined ? { cliente_id } : {}),
    ...(cliente_nome !== undefined ? { cliente_nome } : {}),
    ...(cliente_telefone !== undefined ? { cliente_telefone } : {}),
    ...(cliente_email !== undefined ? { cliente_email } : {})
  });

  // A OS ainda está ativa (não finalizada), então atualiza o espelho também
  // — inclusive o telefone/nome, já que é dali que o Painel principal lê
  // pro botão de ligar.
  await update(ref(db, `os_ativas/${idOs}`), {
    descricao_servico,
    nome_mecanico: nome_mecanico || '',
    lucro_previsto,
    ...(cliente_id !== undefined ? { cliente_id } : {}),
    ...(cliente_nome !== undefined ? { cliente_nome } : {}),
    ...(cliente_telefone !== undefined ? { cliente_telefone } : {}),
    ...(cliente_email !== undefined ? { cliente_email } : {})
  }).catch(() => {});
}

// ---------- FINANCEIRO: LISTAGEM DE LANÇAMENTOS ----------
// Lista os lançamentos (entradas e saídas) de um período — por padrão o mês
// atual, mas aceita um intervalo customizado para navegação mês a mês na tela.
// Retorna do mais recente para o mais antigo.
// Obs: busca o nó inteiro e filtra em JS (em vez de orderByChild/startAt) para
// não exigir configurar ".indexOn" nas regras do Realtime Database — para o
// volume de uma oficina isso é tranquilo e evita erro de configuração.
export async function listarLancamentosFinanceiros({ inicio, fim } = {}) {
  const inicioMs = inicio ? inicio.getTime() : (() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const fimMs = fim ? fim.getTime() : Date.now() + 1;

  const snap = await get(ref(db, 'financeiro'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, lancamento]) => ({
      id,
      ...lancamento,
      tipo: String(lancamento.tipo || '').toLowerCase() === 'entrada' ? 'entrada' : (String(lancamento.tipo || '').toLowerCase() === 'saida' ? 'saida' : null),
      valor: Number(lancamento.valor) || 0,
      data: normalizarTimestamp(lancamento.data)
    }))
    .filter((l) => l.tipo && l.data >= inicioMs && l.data <= fimMs)
    .sort((a, b) => b.data - a.data);
}
export async function atualizarStatusOperacional(placa, idOs, novoStatus) {
  const placaUpper = placa.toUpperCase();
  await update(ref(db, `veiculos/${placaUpper}/ordens_servico/${idOs}`), { status_operacional: novoStatus });
  // Se a OS ainda estiver em os_ativas (não finalizada), atualiza o espelho também.
  await update(ref(db, `os_ativas/${idOs}`), { status_operacional: novoStatus }).catch(() => {});
}

// ---------- DASHBOARD: OS ATIVAS ----------
// Leitura pontual (usada em telas que só precisam de um snapshot único).
export async function listarOSAtivas() {
  const snap = await get(ref(db, 'os_ativas'));
  if (!snap.exists()) return [];
  return Object.values(snap.val());
}

// Listener em tempo real — preferível no Dashboard: atualiza sozinho assim
// que qualquer OS é aberta/mudar de status/finalizada, sem precisar recarregar
// a página. Retorna uma função para cancelar a escuta (chame no cleanup do useEffect).
export function ouvirOSAtivas(callback) {
  const osRef = ref(db, 'os_ativas');
  return onValue(osRef, (snap) => {
    const val = snap.val();
    callback(val ? Object.values(val) : []);
  });
}

// ---------- REVISÕES PENDENTES ----------
export async function listarRevisoesPendentes() {
  const snap = await get(ref(db, 'revisoes'));
  if (!snap.exists()) return [];
  const agora = Date.now();
  return Object.values(snap.val())
    .map((r) => ({
      ...r,
      dias_desde_ultima_troca: Math.floor((agora - (r.ultima_troca_em || agora)) / (1000 * 60 * 60 * 24))
    }))
    .filter((r) => r.dias_desde_ultima_troca > LIMITE_DIAS_REVISAO);
}

// ---------- DESPESAS (fixas e imprevistos) ----------
// Lançamento manual de saída no financeiro, pra categorias que não vêm de
// uma OS: aluguel, água, energia, ferramentas, imprevisto, etc. Isso é o que
// falta pra "Lucro do Mês" refletir o lucro REAL do negócio, não só o que
// entrou/saiu por causa de atendimentos.
export const CATEGORIAS_DESPESA_LABELS = {
  aluguel: 'Aluguel',
  agua: 'Água',
  energia: 'Energia',
  ferramentas: 'Ferramentas',
  imprevisto: 'Imprevisto',
  outro: 'Outro'
};

export async function lancarDespesa({ categoria, descricao, valor, data }) {
  await push(ref(db, 'financeiro'), {
    tipo: 'saida',
    categoria,
    valor: Number(valor) || 0,
    descricao: descricao || CATEGORIAS_DESPESA_LABELS[categoria] || 'Despesa',
    data: data ? new Date(data).getTime() : serverTimestamp()
  });
}

// ---------- FINANCEIRO: LUCRO DO MÊS ----------
// Mesma lógica: busca o nó inteiro e filtra em JS, sem depender de índice
// configurado nas regras do Realtime Database.
export async function obterResumoDashboard() {
  const [financeiroSnap, osSnap, estoqueSnap] = await Promise.all([
    get(ref(db, 'financeiro')),
    get(ref(db, 'os_ativas')),
    get(ref(db, 'estoque'))
  ]);

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMs = inicioMes.getTime();
  let entradas = 0;
  let saidas = 0;

  if (financeiroSnap.exists()) {
    Object.values(financeiroSnap.val()).forEach((l) => {
      if (normalizarTimestamp(l.data) < inicioMs) return;
      const valor = Number(l.valor) || 0;
      const tipo = String(l.tipo || '').toLowerCase();
      if (tipo === 'entrada') entradas += valor;
      if (tipo === 'saida') saidas += valor;
    });
  }

  const osAtivas = osSnap.exists() ? Object.values(osSnap.val()) : [];
  const estoquePrioridade = estoqueSnap.exists()
    ? Object.entries(estoqueSnap.val())
      .map(([id, p]) => ({ id, ...p }))
      .filter((p) => Boolean(p.prioridade) && Number(p.quantidade) <= 0)
    : [];

  return {
    entradas,
    saidas,
    lucro: entradas - saidas,
    os_abertas: osAtivas.length,
    os_em_processo: osAtivas.filter((o) => o.status_operacional === STATUS_OPERACIONAL.EM_ANDAMENTO).length,
    os_aguardando_pagamento: osAtivas.filter((o) => o.status_operacional === STATUS_OPERACIONAL.PRONTO_PAGAMENTO).length,
    alertas_estoque: estoquePrioridade
  };
}

export async function calcularLucroDoMes() {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMs = inicioMes.getTime();

  const snap = await get(ref(db, 'financeiro'));
  let entradas = 0;
  let saidas = 0;
  if (snap.exists()) {
    Object.values(snap.val())
      .filter((v) => normalizarTimestamp(v.data) >= inicioMs)
      .forEach((v) => {
        const tipo = String(v.tipo || '').toLowerCase();
        const valor = Number(v.valor) || 0;
        if (tipo === 'entrada') entradas += valor;
        else if (tipo === 'saida') saidas += valor;
      });
  }
  return { entradas, saidas, lucro: entradas - saidas };
}

// ---------- REMOVER OS (apenas "aberta" e "não iniciada") ----------
export async function removerOS(placa, idOs) {
  const placaUpper = placa.toUpperCase();
  const osRef = ref(db, `veiculos/${placaUpper}/ordens_servico/${idOs}`);
  const osSnap = await get(osRef);
  if (!osSnap.exists()) throw new Error('OS não encontrada.');
  const osAtual = osSnap.val();
  if (osAtual.status !== 'aberta' || osAtual.status_operacional !== 'nao_iniciado') {
    throw new Error('Só é possível remover OS que estão "Aberta" e "Não iniciada".');
  }

  // Somente itens explicitamente marcados como retirados pelo sistema novo
  // são devolvidos. OS antigas continuam intactas e não sofrem ajuste cego.
  const itens = Array.isArray(osAtual.itens)
    ? osAtual.itens
    : Object.values(osAtual.itens || {});
  for (const item of itens) {
    if (!item.retirado_estoque) continue;
    await devolverEstoque({
      estoqueId: item.estoque_id,
      codigo: item.codigo,
      nome: item.nome_peca,
      quantidade: item.quantidade
    });
  }

  await remove(osRef);
  await remove(ref(db, `os_ativas/${idOs}`)).catch(() => {});
}

// ---------- AUTENTICAÇÃO ----------
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './config';

export async function loginUsuario(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

export async function registrarUsuario({ email, senha, nome }) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  if (nome) await updateProfile(cred.user, { displayName: nome });
  await set(ref(db, `usuarios/${cred.user.uid}`), {
    uid: cred.user.uid,
    nome: nome || '',
    email,
    funcao: 'atendente',
    criado_em: serverTimestamp()
  });
  return cred.user;
}

export async function salvarPerfilUsuario(uid, dados) {
  await update(ref(db, `usuarios/${uid}`), dados);
}

// ---------- CLIENTES ----------
// Cadastro novo separado dos veículos. Registros antigos continuam sendo lidos
// normalmente através de cliente_nome/cliente_telefone nos veículos e OS.
export async function listarClientes(busca = '') {
  const snap = await get(ref(db, 'clientes'));
  if (!snap.exists()) return [];
  const termo = normalizarNome(busca);
  return Object.entries(snap.val())
    .map(([id, cliente]) => ({ id, ...cliente }))
    .filter((c) => !termo || [c.nome, c.email, c.whatsapp, c.cpf].map(normalizarNome).some(v => v.includes(termo)))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
}

export async function buscarClientes(termo = '') {
  return listarClientes(termo);
}

export async function salvarCliente({ id, nome, email, whatsapp, cpf, observacao }) {
  const dados = {
    nome: String(nome || '').trim(),
    nome_normalizado: normalizarNome(nome),
    email: String(email || '').trim().toLowerCase(),
    whatsapp: String(whatsapp || '').trim(),
    cpf: String(cpf || '').trim(),
    observacao: String(observacao || '').trim(),
    atualizado_em: serverTimestamp()
  };
  if (!dados.nome) throw new Error('Nome do cliente é obrigatório.');
  if (id) {
    await update(ref(db, `clientes/${id}`), dados);
    return id;
  }
  const novaRef = push(ref(db, 'clientes'));
  await set(novaRef, { ...dados, criado_em: serverTimestamp() });
  return novaRef.key;
}

export async function removerCliente(id) {
  await remove(ref(db, `clientes/${id}`));
}

export async function buscarClientePorId(id) {
  if (!id) return null;
  const snap = await get(ref(db, `clientes/${id}`));
  return snap.exists() ? { id, ...snap.val() } : null;
}
