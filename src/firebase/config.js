import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Substitua pelos dados do SEU projeto Firebase (Console > Configurações do projeto).
// Nunca comite chaves de produção em repositórios públicos — use .env.local.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // OBRIGATÓRIO para Realtime Database (Firestore não precisa disso, por
  // isso não estava no .env antes). Pegue em Console > Realtime Database,
  // é a URL que aparece no topo da página (ex: https://SEU-PROJETO-default-rtdb.firebaseio.com)
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
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
