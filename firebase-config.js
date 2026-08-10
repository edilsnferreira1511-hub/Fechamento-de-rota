/* ============================================================
   CONFIGURAÇÃO DO FIREBASE
   ------------------------------------------------------------
   Já conectado ao seu projeto: barbearia-b244b ✅
   Ainda faltam, no Firebase Console (console.firebase.google.com):
   1) Authentication > Sign-in method > ativar "E-mail/senha" e "Anônimo"
   2) Firestore Database > criar banco (modo produção)
   3) Firestore Database > Regras > colar o conteúdo de firestore.rules
   4) Criar o PIN admin (tela "Primeiro acesso" em admin.html)
   Esse objeto abaixo pode ficar público no frontend sem problema:
   ele só identifica o projeto. Quem protege os dados de verdade são
   as REGRAS do Firestore e a autenticação.
   ------------------------------------------------------------
   IMPORTANTE: cada página (index.html, admin.html, barbeiro.html)
   define window.FIREBASE_APP_NAME ANTES de carregar este arquivo,
   com um nome diferente ("client-app", "admin-app", "barber-app").
   Isso garante que o login do cliente, do admin e do barbeiro fiquem
   em sessões separadas no mesmo navegador/celular — sem isso, entrar
   como barbeiro "contaminava" a sessão do cliente e vice-versa.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDMAjpjz4Gw4n5qGqyMBKBsTWc-ZkYlMhw",
  authDomain: "barbearia-b244b.firebaseapp.com",
  projectId: "barbearia-b244b",
  storageBucket: "barbearia-b244b.firebasestorage.app",
  messagingSenderId: "348369484535",
  appId: "1:348369484535:web:1715bd92e79b9c967b71f2",
  measurementId: "G-297RKJLL0F"
};

const firebaseApp = firebase.initializeApp(firebaseConfig, window.FIREBASE_APP_NAME || "client-app");

const db = firebaseApp.firestore();
const auth = firebaseApp.auth();
// analytics só existe se o SDK do Analytics foi incluído na página (index.html)
const analytics = (typeof firebase.analytics === 'function') ? firebaseApp.analytics() : null;

// E-mail interno fixo usado apenas para autenticar o PIN do administrador.
// A conta é criada automaticamente na primeira vez que alguém abre
// admin.html (tela "Primeiro acesso") — não precisa mexer no Firebase
// Console pra isso.
const ADMIN_INTERNAL_EMAIL = "admin@dennerbarbearia.internal";
