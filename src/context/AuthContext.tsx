import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthValue } from './authContext';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);

  const value: AuthValue = {
    user,
    loading,
    login: async () => { await signInWithPopup(auth, googleProvider); },
    logout: async () => { await signOut(auth); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

