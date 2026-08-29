import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlarmClock, ArrowLeftRight, BarChart3, CalendarClock, CreditCard, FileSpreadsheet, LayoutDashboard, ListChecks,
  LogOut, Menu, MoreHorizontal, Package, PieChart, Settings, Tags, Target, Users2, Wallet, X,
} from 'lucide-react';
import type { ModuleKey } from '../../types';
import { MODULE_LABEL } from '../../utils/access';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import RateBanner from './RateBanner';
import WriteErrorToast from './WriteErrorToast';

interface NavItem { to: string; module: ModuleKey; icon: ReactNode; }
interface NavGroup { label: string; items: NavItem[]; }

const GROUPS: NavGroup[] = [
  {
    label: 'Finanzas',
    items: [
      { to: '/', module: 'resumen', icon: <LayoutDashboard size={18} /> },
      { to: '/recordatorios', module: 'recordatorios', icon: <AlarmClock size={18} /> },
      { to: '/movimientos', module: 'movimientos', icon: <ArrowLeftRight size={18} /> },
      { to: '/costos-fijos', module: 'costos-fijos', icon: <CalendarClock size={18} /> },
      { to: '/deudas', module: 'deudas', icon: <CreditCard size={18} /> },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { to: '/presupuesto', module: 'presupuesto', icon: <PieChart size={18} /> },
      { to: '/reportes', module: 'reportes', icon: <BarChart3 size={18} /> },
      { to: '/metas', module: 'metas', icon: <Target size={18} /> },
      { to: '/tasa', module: 'tasa', icon: <Wallet size={18} /> },
    ],
  },
  {
    label: 'Casa',
    items: [
      { to: '/inventario', module: 'inventario', icon: <Package size={18} /> },
      { to: '/compras', module: 'compras', icon: <ListChecks size={18} /> },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/catalogos', module: 'catalogos', icon: <Tags size={18} /> },
      { to: '/importar', module: 'importar', icon: <FileSpreadsheet size={18} /> },
      { to: '/usuarios', module: 'usuarios', icon: <Users2 size={18} /> },
      { to: '/ajustes', module: 'ajustes', icon: <Settings size={18} /> },
    ],
  },
];

const MOBILE_PRIMARY: ModuleKey[] = ['resumen', 'recordatorios', 'movimientos', 'compras'];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, isGuest, linkGoogle, logout } = useAuth();
  const { canView, roleName } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();

  const linkClass = (base: string) => ({ isActive }: { isActive: boolean }) => `${base}${isActive ? ' active' : ''}`;
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canView(i.module)) })).filter((g) => g.items.length > 0);
  const allItems = groups.flatMap((g) => g.items);
  const primary = allItems.filter((i) => MOBILE_PRIMARY.includes(i.module));
  const secondary = allItems.filter((i) => !MOBILE_PRIMARY.includes(i.module));
  const currentTitle = allItems.find((i) => i.to === pathname)?.module;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand">
          <span className="brand-mark">Bs</span>
          <div className="brand-text">
            <div className="brand-name">Bolívar Vivo</div>
            <div className="brand-tagline">Tus finanzas contra la inflación</div>
          </div>
        </div>

        <nav className="nav" aria-label="Principal">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass('nav-link')}>
                  {n.icon}<span className="truncate">{MODULE_LABEL[n.module]}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="truncate strong">{isGuest ? 'Invitado' : user?.email}</span>
            <span className="truncate">{roleName}</span>
          </div>
          {isGuest
            ? <button type="button" className="btn btn-outline btn-sm btn-block" onClick={linkGoogle}>Vincular con Google</button>
            : <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={logout}><LogOut size={14} /> Cerrar sesión</button>}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost btn-icon only-mobile" onClick={() => setMoreOpen(true)} aria-label="Abrir menú"><Menu size={18} /></button>
          <h1 className="topbar-title truncate">{currentTitle ? MODULE_LABEL[currentTitle] : 'Bolívar Vivo'}</h1>
          <RateBanner />
        </header>
        <main className="shell-content">{children}</main>
      </div>

      <nav className="bottomnav" aria-label="Navegación móvil">
        {primary.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass('bottomnav-link')}>
            {n.icon}<span className="bottomnav-label">{MODULE_LABEL[n.module]}</span>
          </NavLink>
        ))}
        <button type="button" className="bottomnav-link" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal size={18} /><span className="bottomnav-label">Más</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="drawer" onClick={() => setMoreOpen(false)} role="presentation">
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div className="brand">
                <span className="brand-mark">Bs</span>
                <div className="brand-text"><div className="brand-name">Bolívar Vivo</div><div className="brand-tagline">{roleName}</div></div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setMoreOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
            </div>
            <nav className="drawer-nav">
              {(secondary.length > 0 ? secondary : allItems).map((n) => (
                <NavLink key={n.to} to={n.to} className={linkClass('drawer-link')} onClick={() => setMoreOpen(false)}>
                  {n.icon}<span className="truncate">{MODULE_LABEL[n.module]}</span>
                </NavLink>
              ))}
            </nav>
            <div className="drawer-foot">
              {isGuest
                ? <button type="button" className="btn btn-outline btn-block" onClick={linkGoogle}>Vincular con Google</button>
                : <button type="button" className="btn btn-ghost btn-block" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>}
            </div>
          </div>
        </div>
      )}

      <WriteErrorToast />
    </div>
  );
}
