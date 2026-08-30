import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import './App.css';
import type { ModuleKey } from './types';
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import { usePermissions } from './hooks/usePermissions';
import { useLastRoute } from './hooks/useLastRoute';
import AppShell from './components/layout/AppShell';
const Dashboard = lazy(() => import('./views/Dashboard'));
const Reminders = lazy(() => import('./views/Reminders'));
const Movements = lazy(() => import('./views/Movements'));
const FixedCosts = lazy(() => import('./views/FixedCosts'));
const Debts = lazy(() => import('./views/Debts'));
const Budgets = lazy(() => import('./views/Budgets'));
const Reports = lazy(() => import('./views/Reports'));
const Inventory = lazy(() => import('./views/Inventory'));
const Shopping = lazy(() => import('./views/Shopping'));
const Rates = lazy(() => import('./views/Rates'));
const Goals = lazy(() => import('./views/Goals'));
const Catalogs = lazy(() => import('./views/Catalogs'));
const Import = lazy(() => import('./views/Import'));
const Users = lazy(() => import('./views/Users'));
const SettingsView = lazy(() => import('./views/SettingsView'));

/** Oculta la vista si el rol no tiene al menos permiso de lectura. */
function Guard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { canView } = usePermissions();
  if (!canView(module)) {
    return (
      <div className="card guard">
        <AlertTriangle size={18} className="text-warn" />
        <div><p className="strong">Sin acceso a este módulo</p><p className="small muted">Pídele a quien administra el espacio que ajuste tu rol.</p></div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { loading, error: authError } = useAuth();
  useLastRoute();
  const { ready, error } = useData();

  if (loading) return <div className="splash muted">Entrando…</div>;

  if (authError) {
    return (
      <div className="splash">
        <div className="card login-card">
          <AlertTriangle size={22} className="text-danger" />
          <p className="strong">No se pudo conectar con Firebase</p>
          <p className="small muted">{authError}</p>
          <p className="tiny muted">Habilita el proveedor <strong>Anónimo</strong> en Authentication → Sign-in method.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="splash">
        <div className="card login-card">
          <AlertTriangle size={22} className="text-danger" />
          <p className="strong">No se pudo leer la base de datos</p>
          <p className="small muted">{error}</p>
          <p className="tiny muted">Si dice «Missing or insufficient permissions», falta publicar las reglas de <code>firestore.rules</code> en Firebase.</p>
        </div>
      </div>
    );
  }
  if (!ready) return <div className="splash muted">Sincronizando tus datos…</div>;

  return (
    <AppShell>
      <Suspense fallback={<div className="splash muted">Cargando…</div>}>
      <Routes>
        <Route path="/" element={<Guard module="resumen"><Dashboard /></Guard>} />
        <Route path="/recordatorios" element={<Guard module="recordatorios"><Reminders /></Guard>} />
        <Route path="/movimientos" element={<Guard module="movimientos"><Movements /></Guard>} />
        <Route path="/costos-fijos" element={<Guard module="costos-fijos"><FixedCosts /></Guard>} />
        <Route path="/deudas" element={<Guard module="deudas"><Debts /></Guard>} />
        <Route path="/presupuesto" element={<Guard module="presupuesto"><Budgets /></Guard>} />
        <Route path="/reportes" element={<Guard module="reportes"><Reports /></Guard>} />
        <Route path="/inventario" element={<Guard module="inventario"><Inventory /></Guard>} />
        <Route path="/compras" element={<Guard module="compras"><Shopping /></Guard>} />
        <Route path="/tasa" element={<Guard module="tasa"><Rates /></Guard>} />
        <Route path="/metas" element={<Guard module="metas"><Goals /></Guard>} />
        <Route path="/catalogos" element={<Guard module="catalogos"><Catalogs /></Guard>} />
        <Route path="/importar" element={<Guard module="importar"><Import /></Guard>} />
        <Route path="/usuarios" element={<Guard module="usuarios"><Users /></Guard>} />
        <Route path="/ajustes" element={<Guard module="ajustes"><SettingsView /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}
