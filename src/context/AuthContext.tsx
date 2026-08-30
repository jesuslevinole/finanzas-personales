import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext, type AuthValue } from './authContext';

/**
 * No hay inicio de sesión visible: la app entra sola con un usuario anónimo.
 * Ese usuario NO define qué datos se ven — todos los dispositivos leen el mismo
 * espacio compartido (ver `src/workspace.ts`). El anónimo existe solo para que
 * las reglas de Firestore puedan exigir `request.auth != null`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) { setUser(u); setLoading(false); return; }
        signInAnonymously(auth).catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'No se pudo conectar con Firebase.');
          setLoading(false);
        });
      }),
    [],
  );

  const value: AuthValue = { user, loading, error };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
