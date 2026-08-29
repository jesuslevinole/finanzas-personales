import { useState, type CSSProperties, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import type { BudgetGroup, Category, UserSettings } from '../types';
import { GROUP_LABEL } from '../utils/finance';
import './SettingsView.css';

const SETTINGS_DOC = 'main';

/** Rubros iniciales basados en el modelo de gastos del usuario. */
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Víveres', group: 'necesidad', color: '#5b3df5', suggestedPct: 18 },
  { name: 'Proteína', group: 'necesidad', color: '#0f8a5f', suggestedPct: 12 },
  { name: 'Frutas y verduras', group: 'necesidad', color: '#16a34a', suggestedPct: 6 },
  { name: 'Panadería', group: 'necesidad', color: '#c2410c', suggestedPct: 3 },
  { name: 'Bebé', group: 'necesidad', color: '#ec4899', suggestedPct: 8 },
  { name: 'Higiene', group: 'necesidad', color: '#0ea5e9', suggestedPct: 4 },
  { name: 'Medicinas', group: 'necesidad', color: '#dc2626', suggestedPct: 3 },
  { name: 'Transporte', group: 'necesidad', color: '#f59e0b', suggestedPct: 6 },
  { name: 'Recargas y servicios', group: 'necesidad', color: '#6366f1', suggestedPct: 3 },
  { name: 'Comisiones e IVA', group: 'necesidad', color: '#64748b', suggestedPct: 2 },
  { name: 'Chuchería y comida rápida', group: 'deseo', color: '#f97316', suggestedPct: 5 },
  { name: 'Salidas y entretenimiento', group: 'deseo', color: '#a855f7', suggestedPct: 5 },
  { name: 'Hogar y electrónica', group: 'deseo', color: '#14b8a6', suggestedPct: 5 },
  { name: 'Ahorro en divisas', group: 'ahorro', color: '#22c55e', suggestedPct: 10 },
];

const COLORS = ['#5b3df5', '#0f8a5f', '#16a34a', '#c2410c', '#ec4899', '#0ea5e9', '#dc2626', '#f59e0b', '#6366f1', '#64748b', '#f97316', '#a855f7', '#14b8a6', '#22c55e'];

export default function SettingsView() {
  const { settings, categories, expenses, set, add, update, del } = useData();
  const [maxDebt, setMaxDebt] = useState(String(settings.maxDebtRatioPct));
  const [months, setMonths] = useState(String(settings.emergencyFundMonths));
  const [split, setSplit] = useState<Record<BudgetGroup, string>>({ necesidad: String(settings.split.necesidad), deseo: String(settings.split.deseo), ahorro: String(settings.split.ahorro) });
  const [saved, setSaved] = useState(false);

  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState<BudgetGroup>('necesidad');
  const [catPct, setCatPct] = useState('');
  const [catColor, setCatColor] = useState(COLORS[0]);

  const splitTotal = Number(split.necesidad) + Number(split.deseo) + Number(split.ahorro);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (splitTotal !== 100) return;
    await set<UserSettings>('settings', SETTINGS_DOC, {
      maxDebtRatioPct: Number(maxDebt) || 35,
      emergencyFundMonths: Number(months) || 3,
      split: { necesidad: Number(split.necesidad), deseo: Number(split.deseo), ahorro: Number(split.ahorro) },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await add<Category>('categories', { name: catName.trim(), group: catGroup, color: catColor, suggestedPct: Number(catPct) || undefined });
    setCatName(''); setCatPct('');
  };

  const seedCategories = async () => {
    await Promise.all(DEFAULT_CATEGORIES.map((c) => add<Category>('categories', c)));
  };

  const removeCategory = (c: Category) => {
    const used = expenses.filter((e) => e.categoryId === c.id).length;
    if (used > 0) { window.alert(`"${c.name}" tiene ${used} gastos asociados. Reasígnalos antes de eliminarlo.`); return; }
    if (window.confirm(`¿Eliminar el rubro "${c.name}"?`)) void del('categories', c.id);
  };

  return (
    <div className="page">
      <div className="page-header"><div><h1>Ajustes</h1><p className="page-subtitle">Reglas con las que se calculan tus reportes.</p></div></div>

      <form className="card stack" onSubmit={saveSettings}>
        <h2 className="card-title">Reglas financieras</h2>
        <div className="form-grid">
          <label className="field"><span className="field-label">Máx. deuda sobre ingreso (%)</span><input className="input num" type="number" min="1" max="100" value={maxDebt} onChange={(e) => setMaxDebt(e.target.value)} /><span className="field-hint">Recomendado: 30–35%.</span></label>
          <label className="field"><span className="field-label">Fondo de emergencia (meses)</span><input className="input num" type="number" min="1" max="12" value={months} onChange={(e) => setMonths(e.target.value)} /><span className="field-hint">Meses de costos fijos a cubrir.</span></label>
        </div>
        <span className="field-label">Reparto del ingreso</span>
        <div className="form-grid">
          {(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => (
            <label key={g} className="field"><span className="field-label">{GROUP_LABEL[g]} (%)</span><input className="input num" type="number" min="0" max="100" value={split[g]} onChange={(e) => setSplit((s) => ({ ...s, [g]: e.target.value }))} /></label>
          ))}
        </div>
        {splitTotal !== 100 && <p className="small text-danger">El reparto debe sumar 100% (ahora suma {splitTotal}%).</p>}
        <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={splitTotal !== 100}>{saved ? 'Guardado' : 'Guardar reglas'}</button></div>
      </form>

      <section className="card stack">
        <div className="card-header"><h2 className="card-title">Rubros de gasto</h2>{categories.length === 0 && <button type="button" className="btn btn-outline btn-sm" onClick={seedCategories}>Cargar rubros sugeridos</button>}</div>
        <form className="settings-cat-form" onSubmit={addCategory}>
          <input className="input" placeholder="Nuevo rubro" value={catName} onChange={(e) => setCatName(e.target.value)} required />
          <select className="input" value={catGroup} onChange={(e) => setCatGroup(e.target.value as BudgetGroup)}>{(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</select>
          <input className="input num" type="number" min="0" max="100" placeholder="% sugerido" value={catPct} onChange={(e) => setCatPct(e.target.value)} />
          <div className="settings-colors" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={catColor === c} className={`settings-color${catColor === c ? ' selected' : ''}`} style={{ '--swatch': c } as CSSProperties} onClick={() => setCatColor(c)} aria-label={c} />)}
          </div>
          <button type="submit" className="btn btn-primary"><Plus size={16} /> Agregar</button>
        </form>
        <ul>
          {categories.map((c) => (
            <li key={c.id} className="list-item">
              <span className="dot" style={{ '--dot-color': c.color } as CSSProperties} />
              <span className="grow strong">{c.name}</span>
              <select className="input settings-group-select" value={c.group} onChange={(e) => update<Category>('categories', c.id, { group: e.target.value as BudgetGroup })} aria-label="Grupo">{(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</select>
              <input className="input settings-pct" type="number" min="0" max="100" value={c.suggestedPct ?? ''} placeholder="%" onChange={(e) => update<Category>('categories', c.id, { suggestedPct: Number(e.target.value) || undefined })} aria-label="Porcentaje sugerido" />
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => removeCategory(c)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
