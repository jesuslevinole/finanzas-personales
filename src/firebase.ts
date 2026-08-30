import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

/**
 * La configuración web de Firebase no es un secreto (viaja al navegador), pero se
 * lee de variables de entorno para poder apuntar a otro proyecto sin tocar código.
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

/**
 * Firestore usa por defecto un canal WebChannel sobre QUIC/HTTP3. En redes
 * venezolanas (y detrás de muchos proxys) ese canal se cae con
 * `ERR_QUIC_PROTOCOL_ERROR` y las escrituras quedan colgadas sin error visible.
 * `experimentalForceLongPolling` lo baja a peticiones HTTP normales: algo más
 * lento, pero funciona donde el canal nativo no.
 * `ignoreUndefinedProperties` evita que un campo opcional vacío rompa el guardado.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});
