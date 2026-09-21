import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Substitua pelos dados do SEU projeto Firebase (Console > Configurações do projeto).
// Nunca comite chaves de produção em repositórios públicos — use .env.local.
const firebaseConfig = {
  apiKey: AIzaSyBRDnsLfhtiuVM0Ydg07NRMed8Qx1_iatQ,
  authDomain: oficina-f3fdb.firebaseapp.com,
  projectId: oficina-f3fdb,
  storageBucket: oficina-f3fdb.firebasestorage.app,
  messagingSenderId: 110443299158,
  appId: 1:110443299158:web:29a5a791fc0743641f96f7,
  // OBRIGATÓRIO para Realtime Database (Firestore não precisa disso, por
  // isso não estava no .env antes). Pegue em Console > Realtime Database,
  // é a URL que aparece no topo da página (ex: https://SEU-PROJETO-default-rtdb.firebaseio.com)
  databaseURL: https://oficina-f3fdb-default-rtdb.firebaseio.com
};

export const app = initializeApp(firebaseConfig);

// --- IMPORTANTE: Realtime Database NÃO tem persistência em disco no Web ---
// Diferente do Firestore (que usava enableIndexedDbPersistence/persistentLocalCache),
// o RTDB só mantém em memória os dados que estão sendo "ouvidos" (via onValue)
// enquanto a aba está aberta. Se o app for fechado sem internet, os dados não
// sobrevivem. Para minimizar isso na prática:
//   - Prefira listeners em tempo real (onValue) às leituras pontuais (get),
//     assim os dados mais usados ficam quentes em memória durante o expediente.
//   - Evite fechar a aba/app no meio de uma operação sem internet.
export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
