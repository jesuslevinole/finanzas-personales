import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthValue {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
