/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_WORKSPACE_ID?: string;
  /** Modelo de Gemini para leer facturas (por defecto gemini-3.5-flash). */
  readonly VITE_GEMINI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
