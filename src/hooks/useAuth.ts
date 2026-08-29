import { useContext } from 'react';
import { AuthContext, type AuthValue } from '../context/authContext';

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
