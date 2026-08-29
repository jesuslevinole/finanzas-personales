import { useEffect, useState, type ReactNode } from 'react';
import { linkWithPopup, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { AuthContext, type AuthValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) { setUser(u); setLoading(false); return; }
        // Sin sesión: entramos de una vez como invitado. Los datos quedan en
        // users/{uid} igual que con Google, y luego se pueden vincular sin perderlos.
        signInAnonymously(auth).catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
          setLoading(false);
        });
      }),
    [],
  );

  const value: AuthValue = {
    user,
    loading,
    error,
    isGuest: user?.isAnonymous ?? false,
    login: async () => { await signInWithPopup(auth, googleProvider); },
    /** Convierte la sesión de invitado en cuenta de Google conservando los datos. */
    linkGoogle: async () => {
      if (!auth.currentUser) return;
      await linkWithPopup(auth.currentUser, googleProvider);
    },
    logout: async () => { await signOut(auth); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
