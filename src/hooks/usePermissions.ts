import { useMemo } from 'react';
import type { AccessLevel, ModuleKey } from '../types';
import { OWNER_ACCESS } from '../utils/access';

export interface Permissions {
  isOwner: boolean;
  roleName: string;
  levelOf: (module: ModuleKey) => AccessLevel;
  canView: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
}

/**
 * La app trabaja sobre un espacio compartido y sin sesiones, así que todo el
 * que la abre tiene acceso completo. El módulo de roles queda como base para
 * cuando se quiera reactivar el acceso por usuario.
 */
export function usePermissions(): Permissions {
  return useMemo(() => ({
    isOwner: true,
    roleName: 'Espacio compartido',
    levelOf: (m: ModuleKey): AccessLevel => OWNER_ACCESS[m],
    canView: () => true,
    canEdit: () => true,
  }), []);
}
