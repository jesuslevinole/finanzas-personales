import { createContext } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Texto del botón que confirma. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar en rojo (borrados). */
  danger?: boolean;
}

/** Devuelve una promesa que resuelve a true si el usuario confirma. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
