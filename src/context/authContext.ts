import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthValue {
  /** Usuario anónimo de Firebase. No determina qué datos se ven. */
  user: User | null;
  loading: boolean;
  /** Mensaje si la conexión inicial falló. */
  error: string | null;
}

export const AuthContext = createContext<AuthValue | null>(null);
