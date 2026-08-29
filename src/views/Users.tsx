import { useState, type FormEvent } from 'react';
import { Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import EmptyState from '../components/ui/EmptyState';
import type { AccessLevel, Member, ModuleKey, Role } from '../types';
import { ACCESS_LABEL, ACCESS_LEVELS, DEFAULT_ROLES, MODULE_KEYS, MODULE_LABEL, OWNER_ACCESS } from '../utils/access';
import { todayIso } from '../utils/dates';
import './Users.css';

export default function Users() {
  const { roles, members, add, update, del } = useData();
  const { canEdit, roleName } = usePermissions();
  const { user } = useAuth();
  const editable = canEdit('usuarios');
  const [openRole, setOpenRole] = useState<string | null>(null);

  const seedRoles = () => Promise.all(DEFAULT_ROLES.map((r) => add<Role>('roles', r)));

  const removeRole = (role: Role) => {
    const used = members.filter((m) => m.roleId === role.id).length;
    if (used > 0) { window.alert(`«${role.name}» está asignado a ${used} usuario(s). Cámbialos de rol primero.`); return; }
    if (window.confirm(`¿Eliminar el rol «${role.name}»?`)) void del('roles', role.id);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Usuarios y roles</h1><p className="page-subtitle">Cada rol define, módulo por módulo, si se puede ver o editar.</p></div>
      </div>

      <div className="card users-me">
        <ShieldCheck size={18} className="text-ok" />
        <div className="grow">
          <div className="strong">{user?.isAnonymous ? 'Sesión de invitado' : user?.email}</div>
          <div className="tiny muted">Tu nivel: {roleName}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Roles</h2>
          {editable && roles.length === 0 && <button type="button" className="btn btn-outline btn-sm" onClick={seedRoles}>Crear roles sugeridos</button>}
        </div>
        {roles.length === 0 ? <EmptyState title="Sin roles" hint="Crea los roles sugeridos (Administrador, Pareja, Solo lectura) y ajústalos." /> : (
          <ul className="users-roles">
            {roles.map((role) => {
              const open = openRole === role.id;
              const counts = MODULE_KEYS.filter((m) => (role.access[m] ?? 'sin_acceso') !== 'sin_acceso').length;
              return (
                <li key={role.id} className="users-role">
                  <div className="users-role-head">
                    <button type="button" className="users-role-toggle grow" onClick={() => setOpenRole(open ? null : role.id)} aria-expanded={open}>
                      <span className="strong">{role.name}</span>
                      <span className="tiny muted">{role.description ?? `${counts} de ${MODULE_KEYS.length} módulos`}</span>
                    </button>
                    <span className="tag">{members.filter((m) => m.roleId === role.id).length} usuarios</span>
                    {editable && <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar rol" onClick={() => removeRole(role)}><Trash2 size={16} /></button>}
                  </div>
                  {open && (
                    <ul className="users-matrix">
                      {MODULE_KEYS.map((m) => (
                        <li key={m} className="users-matrix-row">
                          <span className="truncate">{MODULE_LABEL[m]}</span>
                          <span className="users-levels" role="radiogroup" aria-label={MODULE_LABEL[m]}>
                            {ACCESS_LEVELS.map((lvl) => (
                              <button key={lvl} type="button" role="radio" disabled={!editable}
                                aria-checked={(role.access[m] ?? 'sin_acceso') === lvl}
                                className={`users-level ${lvl}${(role.access[m] ?? 'sin_acceso') === lvl ? ' selected' : ''}`}
                                onClick={() => update<Role>('roles', role.id, { access: { ...role.access, [m]: lvl } })}>
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
        {editable && roles.length > 0 && <NewRoleForm />}
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Usuarios con acceso</h2></div>
        {members.length === 0 ? (
          <EmptyState title="Solo tú" hint="Agrega el correo de Google de quien quieras que entre, y asígnale un rol." />
        ) : (
          <ul>
            {members.map((m) => (
              <li key={m.id} className="users-member">
                <div className="grow"><div className="strong truncate">{m.name || m.email}</div><div className="tiny muted truncate">{m.email}</div></div>
                <select className="input users-role-select" value={m.roleId} disabled={!editable} aria-label="Rol"
                  onChange={(e) => update<Member>('members', m.id, { roleId: e.target.value })}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {editable && <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar acceso" onClick={() => { if (window.confirm(`¿Quitar el acceso de ${m.email}?`)) void del('members', m.id); }}><Trash2 size={16} /></button>}
              </li>
            ))}
          </ul>
        )}
        {editable && roles.length > 0 && <NewMemberForm roles={roles} />}
        <p className="tiny muted users-note">El acceso se concede por correo de Google. La persona entra con ese correo y hereda los permisos de su rol.</p>
      </section>
    </div>
  );
}

function NewRoleForm() {
  const { add } = useData();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const access: Partial<Record<ModuleKey, AccessLevel>> = { ...OWNER_ACCESS, usuarios: 'sin_acceso', ajustes: 'sin_acceso', importar: 'sin_acceso' };
    await add<Role>('roles', { name: name.trim(), description: description.trim() || undefined, access });
    setName(''); setDescription('');
  };

  return (
    <form className="users-form" onSubmit={submit}>
      <input className="input" placeholder="Nombre del rol" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="input" placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button type="submit" className="btn btn-primary"><Plus size={16} /> Crear rol</button>
    </form>
  );
}

function NewMemberForm({ roles }: { roles: Role[] }) {
  const { set } = useData();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !roleId) return;
    // El id del documento es el correo: así las reglas de Firestore lo resuelven directo.
    await set<Member>('members', clean, { email: clean, name: name.trim() || undefined, roleId, createdAt: todayIso() });
    setEmail(''); setName('');
  };

  return (
    <form className="users-form" onSubmit={submit}>
      <input className="input" type="email" placeholder="correo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Rol">
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button type="submit" className="btn btn-primary"><UserPlus size={16} /> Dar acceso</button>
    </form>
  );
}
