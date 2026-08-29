import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthValue {
  user: User | null;
  loading: boolean;
  /** Mensaje si el inicio de sesión automático falló. */
  error: string | null;
  /** true cuando la sesión es de invitado (anónima). */
  isGuest: boolean;
  login: () => Promise<void>;
  linkGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
