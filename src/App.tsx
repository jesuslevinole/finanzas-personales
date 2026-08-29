import { Route, Routes } from 'react-router-dom';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useData } from './hooks/useData';
import AppShell from './components/layout/AppShell';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Movements from './views/Movements';
import FixedCosts from './views/FixedCosts';
import Debts from './views/Debts';
import Budgets from './views/Budgets';
import Reports from './views/Reports';
import Inventory from './views/Inventory';
import Shopping from './views/Shopping';
import Rates from './views/Rates';
import SettingsView from './views/SettingsView';

export default function App() {
  const { user, loading } = useAuth();
  const { ready } = useData();

  if (loading) return <div className="splash muted">Cargando…</div>;
  if (!user) return <Login />;
  if (!ready) return <div className="splash muted">Sincronizando tus datos…</div>;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/movimientos" element={<Movements />} />
        <Route path="/costos-fijos" element={<FixedCosts />} />
        <Route path="/deudas" element={<Debts />} />
        <Route path="/presupuesto" element={<Budgets />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/inventario" element={<Inventory />} />
        <Route path="/compras" element={<Shopping />} />
        <Route path="/tasa" element={<Rates />} />
        <Route path="/ajustes" element={<SettingsView />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </AppShell>
  );
}
