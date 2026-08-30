import { useState } from 'react';
import { ShieldCheck, Trash2, Plus } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import EmptyState from '../components/ui/EmptyState';
import type { AccessLevel, Role } from '../types';
import { ACCESS_LABEL, ACCESS_LEVELS, DEFAULT_ROLES, MODULE_KEYS, MODULE_LABEL } from '../utils/access';
import './Users.css';

/**
 * La app funciona sin sesiones: quien abre la URL tiene acceso total. Los roles
 * quedan definidos aquí para el día que se quiera reactivar el acceso por
 * persona, pero hoy no restringen nada.
 */
export default function Users() {
  const { roles, add, update, del } = useData();
  const { roleName } = usePermissions();
  const confirm = useConfirm();
  const [openRole, setOpenRole] = useState<string | null>(null);

  const seedRoles = () => Promise.all(DEFAULT_ROLES.map((r) => add<Role>('roles', r)));

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Roles</h1><p className="page-subtitle">Plantillas de permisos, guardadas para cuando se active el acceso por persona.</p></div>
      </div>

      <div className="card users-me">
        <ShieldCheck size={18} className="text-ok" />
        <div className="grow">
          <div className="strong">{roleName}</div>
          <div className="tiny muted">Esta app abre sin inicio de sesión: todos los dispositivos ven y editan los mismos datos.</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Roles definidos</h2>
          {roles.length === 0 && <button type="button" className="btn btn-outline btn-sm" onClick={seedRoles}><Plus size={14} /> Crear roles sugeridos</button>}
        </div>
        {roles.length === 0 ? (
          <EmptyState title="Sin roles" hint="Puedes dejar preparados Administrador, Pareja y Solo lectura para más adelante." />
        ) : (
          <ul className="users-roles">
            {roles.map((role) => {
              const open = openRole === role.id;
              const count = MODULE_KEYS.filter((m) => (role.access[m] ?? 'sin_acceso') !== 'sin_acceso').length;
              return (
                <li key={role.id} className="users-role">
                  <div className="users-role-head">
                    <button type="button" className="users-role-toggle grow" onClick={() => setOpenRole(open ? null : role.id)} aria-expanded={open}>
                      <span className="strong">{role.name}</span>
                      <span className="tiny muted">{role.description ?? `${count} de ${MODULE_KEYS.length} módulos`}</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar rol"
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Eliminar el rol «${role.name}»?`, confirmLabel: 'Eliminar', danger: true });
                        if (ok) await del('roles', role.id);
                      }}><Trash2 size={16} /></button>
                  </div>
                  {open && (
                    <ul className="users-matrix">
                      {MODULE_KEYS.map((m) => (
                        <li key={m} className="users-matrix-row">
                          <span className="truncate">{MODULE_LABEL[m]}</span>
                          <span className="users-levels" role="radiogroup" aria-label={MODULE_LABEL[m]}>
                            {ACCESS_LEVELS.map((lvl) => (
                              <button key={lvl} type="button" role="radio"
                                aria-checked={(role.access[m] ?? 'sin_acceso') === lvl}
                                className={`users-level ${lvl}${(role.access[m] ?? 'sin_acceso') === lvl ? ' selected' : ''}`}
                                onClick={() => update<Role>('roles', role.id, { access: { ...role.access, [m]: lvl as AccessLevel } })}>
                                {ACCESS_LABEL[lvl]}
                              </button>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
