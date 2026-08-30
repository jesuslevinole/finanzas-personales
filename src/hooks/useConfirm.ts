import { useContext } from 'react';
import { ConfirmContext, type ConfirmFn } from '../context/confirmContext';

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
};
