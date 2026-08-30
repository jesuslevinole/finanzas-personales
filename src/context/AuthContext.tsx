import { useEffect, useState, type ReactNode } from 'react';
import {
  getRedirectResult, linkWithPopup, linkWithRedirect, onAuthStateChanged, signInAnonymously,
  signInWithCredential, signInWithPopup, signOut, GoogleAuthProvider, type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { AuthContext, type AuthValue } from './authContext';

/** En un teléfono los popups suelen bloquearse: ahí se usa redirección. */
const prefersRedirect = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

const errorCode = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resultado de una vinculación por redirección (vuelta desde Google).
    getRedirectResult(auth).catch((e: unknown) => {
      if (errorCode(e) === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(e as never);
        if (credential) void signInWithCredential(auth, credential);
      }
    });

    return onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setLoading(false); return; }
      // Sin sesión: entramos como invitado. Los datos quedan bajo ese uid, que
      // vive solo en este navegador; por eso conviene vincular con Google.
      signInAnonymously(auth).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
        setLoading(false);
      });
    });
  }, []);

  /**
   * Convierte la sesión de invitado en cuenta de Google conservando los datos.
   * Si esa cuenta ya existe (por ejemplo, ya entraste en la computadora), se
   * inicia sesión con ella: los datos del invitado de ESTE equipo quedan atrás,
   * pero recuperas los del espacio real.
   */
  const linkGoogle = async () => {
    if (!auth.currentUser) return;
    try {
      if (prefersRedirect()) {
        await linkWithRedirect(auth.currentUser, googleProvider);
        return;
      }
      await linkWithPopup(auth.currentUser, googleProvider);
    } catch (e: unknown) {
      const code = errorCode(e);
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(e as never);
        if (credential) { await signInWithCredential(auth, credential); return; }
      }
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await linkWithRedirect(auth.currentUser, googleProvider);
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudo vincular la cuenta.');
    }
  };

  const value: AuthValue = {
    user,
    loading,
    error,
    isGuest: user?.isAnonymous ?? false,
    login: async () => { await signInWithPopup(auth, googleProvider); },
    linkGoogle,
    logout: async () => { await signOut(auth); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
