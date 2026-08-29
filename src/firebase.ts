import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

/**
 * La configuración web de Firebase no es un secreto (viaja al navegador), pero se
 * lee de variables de entorno para poder apuntar a otro proyecto sin tocar código.
 * En Cloudflare Pages se cargan en Settings → Environment variables.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Falta la configuración de Firebase. Copia .env.example a .env con tus credenciales, ' +
      'o define las variables VITE_FIREBASE_* en tu proveedor de hosting.',
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// `ignoreUndefinedProperties` evita que un campo opcional vacío (reference, note,
// description…) rompa la escritura: Firestore rechaza `undefined` por defecto.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const googleProvider = new GoogleAuthProvider();
