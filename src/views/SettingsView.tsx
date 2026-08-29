import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import type { BudgetGroup, UserSettings } from '../types';
import { GROUP_LABEL } from '../utils/finance';
import './SettingsView.css';

const SETTINGS_DOC = 'main';

export default function SettingsView() {
  const { settings, set } = useData();
  const { canEdit } = usePermissions();
  const editable = canEdit('ajustes');
  const [maxDebt, setMaxDebt] = useState(String(settings.maxDebtRatioPct));
  const [months, setMonths] = useState(String(settings.emergencyFundMonths));
  const [savings, setSavings] = useState(String(settings.savingsTargetPct));
  const [household, setHousehold] = useState(String(settings.householdSize));
  const [split, setSplit] = useState<Record<BudgetGroup, string>>({
    necesidad: String(settings.split.necesidad),
    deseo: String(settings.split.deseo),
    ahorro: String(settings.split.ahorro),
  });
  const [saved, setSaved] = useState(false);

  const splitTotal = Number(split.necesidad) + Number(split.deseo) + Number(split.ahorro);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (splitTotal !== 100) return;
    await set<UserSettings>('settings', SETTINGS_DOC, {
      maxDebtRatioPct: Number(maxDebt) || 25,
      emergencyFundMonths: Number(months) || 4,
      savingsTargetPct: Number(savings) || 15,
      householdSize: Number(household) || 1,
      split: { necesidad: Number(split.necesidad), deseo: Number(split.deseo), ahorro: Number(split.ahorro) },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <div className="page-header"><div><h1>Ajustes</h1><p className="page-subtitle">Las reglas con las que se calculan tus reportes y recomendaciones.</p></div></div>

      <form className="card stack" onSubmit={saveSettings}>
        <h2 className="card-title">Reglas financieras</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Máx. deuda sobre ingreso (%)</span>
            <input className="input num" type="number" min="1" max="100" value={maxDebt} disabled={!editable} onChange={(e) => setMaxDebt(e.target.value)} />
            <span className="field-hint">Con ingresos variables, 20–25% es más seguro que el 35% clásico.</span>
          </label>
          <label className="field">
            <span className="field-label">Fondo de emergencia (meses)</span>
            <input className="input num" type="number" min="1" max="12" value={months} disabled={!editable} onChange={(e) => setMonths(e.target.value)} />
            <span className="field-hint">Meses de costos fijos a cubrir.</span>
          </label>
          <label className="field">
            <span className="field-label">Meta de ahorro mensual (%)</span>
            <input className="input num" type="number" min="0" max="80" value={savings} disabled={!editable} onChange={(e) => setSavings(e.target.value)} />
            <span className="field-hint">Del ingreso propio, apartado el día que cobras.</span>
          </label>
          <label className="field">
            <span className="field-label">Personas en el hogar</span>
            <input className="input num" type="number" min="1" max="15" value={household} disabled={!editable} onChange={(e) => setHousehold(e.target.value)} />
            <span className="field-hint">Se usa para el gasto por persona en Reportes.</span>
          </label>
        </div>
        <span className="field-label">Reparto del ingreso</span>
        <div className="form-grid">
          {(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => (
            <label key={g} className="field">
              <span className="field-label">{GROUP_LABEL[g]} (%)</span>
              <input className="input num" type="number" min="0" max="100" value={split[g]} disabled={!editable} onChange={(e) => setSplit((s) => ({ ...s, [g]: e.target.value }))} />
            </label>
          ))}
        </div>
        {splitTotal !== 100 && <p className="small text-danger">El reparto debe sumar 100% (ahora suma {splitTotal}%).</p>}
        {editable && <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={splitTotal !== 100}>{saved ? 'Guardado' : 'Guardar reglas'}</button></div>}
      </form>

      <section className="card">
        <h2 className="card-title">Metas, catálogos y accesos</h2>
        <p className="small muted settings-note">
          Las metas de ahorro se configuran en <Link to="/metas">Metas</Link>.
          Los rubros, lugares, acreedores y orígenes en <Link to="/catalogos">Catálogos</Link>,
          y los permisos por módulo en <Link to="/usuarios">Usuarios y roles</Link>.
        </p>
      </section>
    </div>
  );
}
