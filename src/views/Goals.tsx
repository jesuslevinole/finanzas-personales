import { useState, type FormEvent } from 'react';
import { Minus, PiggyBank, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useMonth } from '../hooks/useMonth';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { useConfirm } from '../hooks/useConfirm';
import type { Goal, GoalKind } from '../types';
import { emergencyFundTarget, monthlyContribution, ownIncomeUsd } from '../utils/finance';
import { formatPct, formatUsd, sum } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Goals.css';

const KIND_LABEL: Record<GoalKind, string> = {
  fondo_emergencia: 'Fondo de emergencia',
  ahorro: 'Ahorro',
  compra: 'Compra planificada',
  salir_de_deuda: 'Salir de una deuda',
  inversion: 'Inversión',
};

export default function Goals() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { monthIncomes, monthFixed } = useMonth();
  const editable = canEdit('metas');
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState<{ goal: Goal; sign: 1 | -1 } | null>(null);

  const incomeUsd = ownIncomeUsd(monthIncomes);
  const emergencyTarget = emergencyFundTarget(monthFixed, data.settings.emergencyFundMonths);
  const goals = [...data.goals].sort((a, b) => a.priority - b.priority);
  const totalTarget = sum(goals.map((g) => g.targetUsd));
  const totalSaved = sum(goals.map((g) => g.savedUsd));
  const monthlyNeeded = sum(goals.map((g) => monthlyContribution(g.targetUsd, g.savedUsd, g.deadline) ?? 0));
  const savingsTarget = incomeUsd * (data.settings.savingsTargetPct / 100);



  const seedEmergency = () => data.add<Goal>('goals', {
    name: 'Fondo de emergencia', kind: 'fondo_emergencia',
    targetUsd: Math.round(emergencyTarget), savedUsd: 0, priority: 1,
    note: `${data.settings.emergencyFundMonths} meses de costos fijos`, createdAt: todayIso(),
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Metas</h1><p className="page-subtitle">Lo que estás construyendo con el dinero que no gastas. En dólares, siempre.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva meta</button>}
      </div>

      <div className="grid grid-4">
        <StatCard tone="usd" icon={<PiggyBank size={18} />} label="Ahorrado en metas"
          value={<span className="num">{formatUsd(totalSaved)}</span>}
          hint={totalTarget > 0 ? `${formatPct(totalSaved / totalTarget)} de ${formatUsd(totalTarget)}` : 'Sin metas activas'} />
        <StatCard tone="primary" icon={<Target size={18} />} label="Aporte mensual necesario"
          value={<span className="num">{formatUsd(monthlyNeeded)}</span>}
          hint="Para llegar a tiempo a las metas con fecha" />
        <StatCard tone={savingsTarget > monthlyNeeded ? 'ok' : 'warn'} icon={<TrendingUp size={18} />} label="Tu meta de ahorro mensual"
          value={<span className="num">{formatUsd(savingsTarget)}</span>}
          hint={`${data.settings.savingsTargetPct}% del ingreso del mes`} />
        <StatCard tone="warn" icon={<PiggyBank size={18} />} label="Fondo de emergencia sugerido"
          value={<span className="num">{formatUsd(emergencyTarget)}</span>}
          hint={`${data.settings.emergencyFundMonths} meses de costos fijos`} />
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState title="Sin metas todavía"
            hint="Empieza por el fondo de emergencia: es lo que evita que un imprevisto se convierta en una deuda nueva."
            action={editable ? <button type="button" className="btn btn-primary" onClick={seedEmergency}>Crear fondo de emergencia ({formatUsd(emergencyTarget)})</button> : undefined} />
        </div>
      ) : (
        <ul className="goals-list">
          {goals.map((goal) => {
            const ratio = goal.targetUsd > 0 ? goal.savedUsd / goal.targetUsd : 0;
            const monthly = monthlyContribution(goal.targetUsd, goal.savedUsd, goal.deadline);
            const done = ratio >= 1;
            return (
              <li key={goal.id} className={`goal-card${done ? ' done' : ''}`}>
                <div className="row-between">
                  <div className="grow">
                    <span className="strong">{goal.name}</span>
                    <div className="tiny muted">{KIND_LABEL[goal.kind]}{goal.deadline && ` · para ${shortDate(goal.deadline)}`}</div>
                  </div>
                  {done ? <span className="tag ok">Completada</span> : <span className="tag primary">{formatPct(ratio)}</span>}
                </div>
                <ProgressBar ratio={ratio} color={done ? 'var(--color-ok)' : 'var(--color-primary)'} />
                <div className="row-between small">
                  <span className="num strong">{formatUsd(goal.savedUsd)} <span className="muted">de {formatUsd(goal.targetUsd)}</span></span>
                  {monthly !== null && !done && <span className="tiny muted num">{formatUsd(monthly)} / mes para llegar</span>}
                </div>
                {goal.note && <p className="tiny muted">{goal.note}</p>}
                {editable && (
                  <div className="goal-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setContributing({ goal, sign: 1 })}><Plus size={14} /> Aportar</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setContributing({ goal, sign: -1 })}><Minus size={14} /> Retirar</button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar meta"
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Eliminar la meta «${goal.name}»?`, confirmLabel: 'Eliminar', danger: true });
                        if (ok) await data.del('goals', goal.id);
                      }}><Trash2 size={15} /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal title="Nueva meta" open={creating} onClose={() => setCreating(false)}>
        <GoalForm nextPriority={goals.length + 1} onDone={() => setCreating(false)} />
      </Modal>
      <Modal title={contributing?.sign === -1 ? 'Retirar de la meta' : 'Aportar a la meta'} open={contributing !== null} onClose={() => setContributing(null)}>
        {contributing && <ContributionForm goal={contributing.goal} sign={contributing.sign} onDone={() => setContributing(null)} />}
      </Modal>
    </div>
  );
}

function ContributionForm({ goal, sign, onDone }: { goal: Goal; sign: 1 | -1; onDone: () => void }) {
  const { update } = useData();
  const [amount, setAmount] = useState('');
  const value = Number(amount) || 0;
  const next = Math.max(0, goal.savedUsd + value * sign);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value <= 0) return;
    await update<Goal>('goals', goal.id, { savedUsd: next });
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <dl className="kv">
        <div><dt>Meta</dt><dd>{goal.name}</dd></div>
        <div><dt>Tienes ahora</dt><dd className="num">{formatUsd(goal.savedUsd)}</dd></div>
        <div><dt>Objetivo</dt><dd className="num">{formatUsd(goal.targetUsd)}</dd></div>
      </dl>
      <label className="field">
        <span className="field-label">{sign === 1 ? 'Cuánto aportas ($)' : 'Cuánto retiras ($)'}</span>
        <input className="input num goal-amount" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </label>
      <p className="field-hint">Quedaría en <strong className="num">{formatUsd(next)}</strong> ({formatPct(goal.targetUsd > 0 ? next / goal.targetUsd : 0)} de la meta).</p>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={value <= 0}>Guardar</button></div>
    </form>
  );
}

function GoalForm({ nextPriority, onDone }: { nextPriority: number; onDone: () => void }) {
  const { add } = useData();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GoalKind>('ahorro');
  const [targetUsd, setTargetUsd] = useState('');
  const [savedUsd, setSavedUsd] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const target = Number(targetUsd);
    if (!name.trim() || target <= 0) return;
    await add<Goal>('goals', {
      name: name.trim(), kind, targetUsd: target, savedUsd: Number(savedUsd) || 0,
      deadline: deadline || undefined, priority: nextPriority, note: note.trim() || undefined, createdAt: todayIso(),
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <label className="field"><span className="field-label">Nombre</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fondo de emergencia, mudanza, laptop…" required /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Tipo</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
            {(Object.keys(KIND_LABEL) as GoalKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Fecha objetivo</span><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Meta ($)</span><input className="input num" type="number" min="0" step="1" value={targetUsd} onChange={(e) => setTargetUsd(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Ya tengo ($)</span><input className="input num" type="number" min="0" step="1" value={savedUsd} onChange={(e) => setSavedUsd(e.target.value)} /></label>
      </div>
      <label className="field"><span className="field-label">Nota</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="form-actions"><button type="submit" className="btn btn-primary">Crear meta</button></div>
    </form>
  );
}
