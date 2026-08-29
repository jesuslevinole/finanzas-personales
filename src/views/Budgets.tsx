import { useState, type CSSProperties } from 'react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import type { Budget } from '../types';
import { categoryTargets, groupTargets, GROUP_LABEL, ownIncomeUsd } from '../utils/finance';
import { formatPct, formatUsd } from '../utils/money';
import './Budgets.css';

const barColor = (ratio: number): string => (ratio >= 1 ? 'var(--color-danger)' : ratio >= 0.8 ? 'var(--color-warn)' : 'var(--color-ok)');

export default function Budgets() {
  const { categories, budgets, settings, add, update, del } = useData();
  const { month, prev, next, monthIncomes, monthExpenses, monthDebts } = useMonth();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const incomeUsd = ownIncomeUsd(monthIncomes);
  const monthBudgets = budgets.filter((b) => b.month === month);
  const groups = groupTargets(incomeUsd, monthExpenses, monthDebts.filter((d) => d.status === 'pagada'), categories, settings);
  const targets = categoryTargets(incomeUsd, monthExpenses, monthBudgets, categories);

  const saveBudget = async (categoryId: string) => {
    const limit = Number(draft);
    const existing = monthBudgets.find((b) => b.categoryId === categoryId);
    if (limit > 0) {
      if (existing) await update<Budget>('budgets', existing.id, { limitUsd: limit });
      else await add<Budget>('budgets', { categoryId, month, limitUsd: limit });
    } else if (existing) {
      await del('budgets', existing.id);
    }
    setEditing(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Presupuesto</h1><p className="page-subtitle">Cuánto deberías gastar en cada rubro según tu ingreso, y cuánto llevas.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      {incomeUsd === 0 && <div className="card budget-note">Registra ingresos propios de este mes para que el presupuesto se calcule sobre tu dinero real.</div>}

      <section className="card">
        <div className="card-header"><h2 className="card-title">Regla {settings.split.necesidad}/{settings.split.deseo}/{settings.split.ahorro}</h2><span className="tag primary">Ingreso: {formatUsd(incomeUsd)}</span></div>
        <div className="grid grid-3">
          {groups.map((g) => {
            const ratio = g.targetUsd > 0 ? g.actualUsd / g.targetUsd : 0;
            return (
              <div key={g.group} className="budget-group">
                <div className="row-between"><span className="strong">{GROUP_LABEL[g.group]}</span><span className="tiny muted">{g.targetPct}%</span></div>
                <ProgressBar ratio={ratio} color={barColor(ratio)} />
                <div className="row-between tiny"><span className="num">{formatUsd(g.actualUsd)} de {formatUsd(g.targetUsd)}</span><span className={`num ${g.diffUsd < 0 ? 'text-danger' : 'text-ok'}`}>{g.diffUsd < 0 ? 'Excedido ' : 'Libre '}{formatUsd(Math.abs(g.diffUsd))}</span></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Por rubro</h2><span className="tiny muted">Toca un rubro para fijar su tope en $</span></div>
        {targets.length === 0 ? <EmptyState title="Sin rubros" hint="Crea rubros en Ajustes y asígnales un % sugerido del ingreso." /> : (
          <ul className="budget-list">
            {targets.map((t) => {
              const limit = t.budgetUsd ?? t.suggestedUsd;
              return (
                <li key={t.categoryId} className="budget-item">
                  <div className="row-between">
                    <span className="row strong"><span className="dot" style={{ '--dot-color': t.color } as CSSProperties} />{t.name}</span>
                    {editing === t.categoryId ? (
                      <span className="row">
                        <input className="input input-sm num" type="number" step="1" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveBudget(t.categoryId)}>OK</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm num" onClick={() => { setEditing(t.categoryId); setDraft(String(t.budgetUsd ?? Math.round(t.suggestedUsd))); }}>
                        {formatUsd(t.actualUsd)} / {limit > 0 ? formatUsd(limit) : '—'}{t.budgetUsd === null && limit > 0 && <span className="tiny muted"> sugerido</span>}
                      </button>
                    )}
                  </div>
                  <ProgressBar ratio={t.usedRatio} color={barColor(t.usedRatio)} />
                  <span className="tiny muted num">{limit > 0 ? `${formatPct(t.usedRatio)} usado` : 'Sin tope definido'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
