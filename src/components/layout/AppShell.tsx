import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowLeftRight, BarChart3, CalendarClock, CreditCard, LayoutDashboard, ListChecks, LogOut, MoreHorizontal, Package, PieChart, Settings, Wallet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import RateBanner from './RateBanner';

interface NavItem { to: string; label: string; icon: ReactNode; }

const NAV: NavItem[] = [
  { to: '/', label: 'Resumen', icon: <LayoutDashboard size={18} /> },
  { to: '/movimientos', label: 'Movimientos', icon: <ArrowLeftRight size={18} /> },
  { to: '/costos-fijos', label: 'Costos fijos', icon: <CalendarClock size={18} /> },
  { to: '/deudas', label: 'Deudas', icon: <CreditCard size={18} /> },
  { to: '/presupuesto', label: 'Presupuesto', icon: <PieChart size={18} /> },
  { to: '/reportes', label: 'Reportes', icon: <BarChart3 size={18} /> },
  { to: '/inventario', label: 'Inventario', icon: <Package size={18} /> },
  { to: '/compras', label: 'Lista de compras', icon: <ListChecks size={18} /> },
  { to: '/tasa', label: 'Tasa BCV', icon: <Wallet size={18} /> },
  { to: '/ajustes', label: 'Ajustes', icon: <Settings size={18} /> },
];

const MOBILE_PRIMARY = NAV.slice(0, 4);

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const linkClass = (base: string) => ({ isActive }: { isActive: boolean }) => `${base}${isActive ? ' active' : ''}`;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand">
          <span className="brand-mark">Bs</span>
          <div>
            <div className="brand-name">Bolívar Vivo</div>
            <div className="brand-tagline">Tus finanzas contra la inflación</div>
          </div>
        </div>
        <nav className="nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass('nav-link')}>{n.icon}{n.label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user truncate">{user?.email}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>

      <div className="shell-main">
        <RateBanner />
        <main className="shell-content">{children}</main>
      </div>

      <nav className="bottomnav" aria-label="Principal móvil">
        {MOBILE_PRIMARY.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass('bottomnav-link')}>{n.icon}{n.label}</NavLink>
        ))}
        <button type="button" className="bottomnav-link" onClick={() => setMoreOpen(true)}><MoreHorizontal size={18} />Más</button>
      </nav>

      {moreOpen && (
        <div className="more-sheet" onClick={() => setMoreOpen(false)} role="presentation">
          <div className="more-panel" onClick={(e) => e.stopPropagation()}>
            {NAV.slice(4).map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass('more-item')} onClick={() => setMoreOpen(false)}>{n.icon}{n.label}</NavLink>
            ))}
            <button type="button" className="more-item" onClick={logout}><LogOut size={18} />Salir</button>
          </div>
        </div>
      )}
    </div>
  );
}
