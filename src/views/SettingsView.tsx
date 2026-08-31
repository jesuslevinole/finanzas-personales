import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import MonthPicker from '../components/ui/MonthPicker';
import type { BudgetGroup, UserSettings } from '../types';
import { GROUP_LABEL } from '../utils/finance';
import { addMonths, monthLabel, todayIso } from '../utils/dates';
import './SettingsView.css';

export default function SettingsView() {
  const { settingsDocs, settingsFor, set } = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { month, prev, next } = useMonth();
  const editable = canEdit('ajustes');

  const active = settingsFor(month);
  /** true si este mes tiene reglas propias; si no, las hereda del mes anterior. */
  const hasOwn = settingsDocs.some((d) => d.month === month);
  const inheritedFrom = settingsDocs
    .filter((d) => d.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0]?.month;

  const [maxDebt, setMaxDebt] = useState('');
  const [months, setMonths] = useState('');
  const [savings, setSavings] = useState('');
  const [household, setHousehold] = useState('');
  const [balanceBs, setBalanceBs] = useState('');
  const [split, setSplit] = useState<Record<BudgetGroup, string>>({ necesidad: '', deseo: '', ahorro: '' });
  const [saved, setSaved] = useState(false);

  // Al cambiar de mes, el formulario se recarga con las reglas de ese mes.
  useEffect(() => {
    setMaxDebt(String(active.maxDebtRatioPct));
    setMonths(String(active.emergencyFundMonths));
    setSavings(String(active.savingsTargetPct));
    setHousehold(String(active.householdSize));
    setBalanceBs(active.balanceBs !== undefined ? String(active.balanceBs) : '');
    setSplit({
      necesidad: String(active.split.necesidad),
      deseo: String(active.split.deseo),
      ahorro: String(active.split.ahorro),
    });
  }, [month, active.maxDebtRatioPct, active.emergencyFundMonths, active.savingsTargetPct, active.householdSize, active.balanceBs, active.split]);

  const splitTotal = Number(split.necesidad) + Number(split.deseo) + Number(split.ahorro);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (splitTotal !== 100) return;
    await set<UserSettings>('settings', month, {
      month,
      maxDebtRatioPct: Number(maxDebt) || 25,
      emergencyFundMonths: Number(months) || 4,
      savingsTargetPct: Number(savings) || 15,
      householdSize: Number(household) || 1,
      balanceBs: balanceBs === '' ? undefined : Number(balanceBs),
      balanceUpdatedAt: balanceBs === '' ? undefined : todayIso(),
      split: { necesidad: Number(split.necesidad), deseo: Number(split.deseo), ahorro: Number(split.ahorro) },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const copyPrev = async () => {
    const prevMonth = addMonths(month, -1);
    const source = settingsFor(prevMonth);
    const ok = await confirm({
      title: `Copiar reglas de ${monthLabel(prevMonth)}`,
      message: 'Se reemplazan las reglas de este mes con las del mes anterior.',
      confirmLabel: 'Copiar',
    });
    if (!ok) return;
    await set<UserSettings>('settings', month, { ...source, month });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Ajustes</h1><p className="page-subtitle">Reglas por mes: puedes apretar o soltar el presupuesto según cómo venga cada mes.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className={`card settings-scope ${hasOwn ? 'own' : 'inherited'}`}>
        <div className="grow">
          <p className="strong small">{hasOwn ? `Reglas propias de ${monthLabel(month)}` : 'Este mes hereda reglas'}</p>
          <p className="tiny muted">
            {hasOwn
              ? 'Los cambios que guardes aquí solo afectan a este mes.'
              : inheritedFrom
                ? `Está usando las reglas de ${monthLabel(inheritedFrom)}. Al guardar, este mes tendrá las suyas.`
                : 'Está usando los valores por defecto. Al guardar, este mes tendrá los suyos.'}
          </p>
        </div>
        {editable && <button type="button" className="btn btn-outline btn-sm" onClick={copyPrev}><Copy size={14} /> Copiar mes anterior</button>}
      </div>

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
            <span className="field-label">Saldo en la cuenta (Bs)</span>
            <input className="input num" type="number" min="0" step="0.01" value={balanceBs} disabled={!editable} onChange={(e) => setBalanceBs(e.target.value)} />
            <span className="field-hint">Se compara con el disponible calculado, en el Resumen.</span>
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
        {editable && (
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={splitTotal !== 100}>
              {saved ? 'Guardado' : `Guardar reglas de ${monthLabel(month)}`}
            </button>
          </div>
        )}
      </form>

      <section className="card">
        <h2 className="card-title">Metas, catálogos y accesos</h2>
        <p className="small muted settings-note">
          Las metas de ahorro se configuran en <Link to="/metas">Metas</Link>.
          Los rubros, lugares, acreedores, orígenes y productos en <Link to="/catalogos">Catálogos</Link>,
          y los permisos por módulo en <Link to="/usuarios">Roles</Link>.
        </p>
      </section>
    </div>
  );
}
