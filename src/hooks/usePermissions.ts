import { useMemo } from 'react';
import type { AccessLevel, ModuleKey } from '../types';
import { OWNER_ACCESS } from '../utils/access';
import { useAuth } from './useAuth';
import { useData } from './useData';

export interface Permissions {
  /** El dueño del espacio (o el invitado que lo creó) manda sobre todo. */
  isOwner: boolean;
  roleName: string;
  levelOf: (module: ModuleKey) => AccessLevel;
  canView: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
}

/** Nivel de acceso del usuario actual, resuelto contra members + roles. */
export function usePermissions(): Permissions {
  const { user } = useAuth();
  const { members, roles } = useData();

  return useMemo(() => {
    const email = user?.email?.toLowerCase() ?? '';
    const member = email ? members.find((m) => m.email.toLowerCase() === email) : undefined;
    const role = member ? roles.find((r) => r.id === member.roleId) ?? null : null;
    // Sin ficha de miembro, quien está en el espacio es su dueño.
    const isOwner = !member;
    const access = isOwner ? OWNER_ACCESS : role?.access ?? {};
    const levelOf = (m: ModuleKey): AccessLevel => access[m] ?? 'sin_acceso';
    return {
      isOwner,
      roleName: isOwner ? 'Dueño del espacio' : role?.name ?? 'Sin rol',
      levelOf,
      canView: (m) => levelOf(m) !== 'sin_acceso',
      canEdit: (m) => levelOf(m) === 'editar',
    };
  }, [user, members, roles]);
}
