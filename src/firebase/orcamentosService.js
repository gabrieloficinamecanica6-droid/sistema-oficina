// Serviço de Orçamentos (Firestore) — coleção "orcamentos"
// Usa getFirestore() (app padrão já inicializado no seu projeto), então não precisa importar o "db".
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, limit, Timestamp
} from 'firebase/firestore';

const COL = 'orcamentos';
const col = () => collection(getFirestore(), COL);

// 'AAAA-MM-DD' -> Timestamp ao MEIO-DIA local (evita o dia voltar por causa do fuso/UTC)
export function dataParaTimestamp(str) {
  const [a, m, d] = String(str).split('-').map(Number);
  return Timestamp.fromDate(new Date(a, m - 1, d, 12, 0, 0));
}

// Timestamp -> 'AAAA-MM-DD' local (para preencher <input type="date">)
export function timestampParaInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function calcularTotais(o) {
  const itens = o.itens || [];
  const totalPecas = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valorUnit) || 0), 0);
  const valorServico = Number(o.valorServico) || 0;
  return { totalPecas, valorServico, total: totalPecas + valorServico };
}

function montarDocumento(dados) {
  const itens = (dados.itens || [])
    .filter((i) => String(i.nome || '').trim())
    .map((i) => ({
      nome: String(i.nome).trim(),
      quantidade: Number(i.quantidade) || 1,
      valorUnit: Number(i.valorUnit) || 0
    }));
  return {
    clienteNome: dados.clienteNome.trim(),
    telefone: (dados.telefone || '').trim(),
    placa: (dados.placa || '').toUpperCase().trim(),
    modelo: (dados.modelo || '').trim(),
    descricao: (dados.descricao || '').trim(),
    observacoes: (dados.observacoes || '').trim(),
    itens,
    ...calcularTotais({ itens, valorServico: dados.valorServico }),
    data: dataParaTimestamp(dados.data),
    validade: dataParaTimestamp(dados.validade)
  };
}

export async function listarOrcamentos() {
  const snap = await getDocs(query(col(), orderBy('criadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function proximoNumero() {
  const snap = await getDocs(query(col(), orderBy('numero', 'desc'), limit(1)));
  return snap.empty ? 1 : (Number(snap.docs[0].data().numero) || 0) + 1;
}

export async function criarOrcamento(dados) {
  const numero = await proximoNumero();
  const ref = await addDoc(col(), {
    ...montarDocumento(dados),
    numero,
    status: 'pendente',
    criadoEm: Timestamp.now()
  });
  return { id: ref.id, numero };
}

export async function atualizarOrcamento(id, dados) {
  await updateDoc(doc(getFirestore(), COL, id), {
    ...montarDocumento(dados),
    atualizadoEm: Timestamp.now()
  });
}

export async function atualizarStatusOrcamento(id, status) {
  await updateDoc(doc(getFirestore(), COL, id), { status, atualizadoEm: Timestamp.now() });
}

export async function excluirOrcamento(id) {
  await deleteDoc(doc(getFirestore(), COL, id));
}