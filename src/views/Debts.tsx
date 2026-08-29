import { useMemo, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import type { Debt, MoneyOwner, NewDoc, PayStatus } from '../types';
import { formatUsd, sum } from '../utils/money';
import { daysBetween, shortDate, todayIso } from '../utils/dates';
import './Debts.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };

export default function Debts() {
  const { debts, currentRate, add, update, del } = useData();
  const [open, setOpen] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const today = todayIso();

  const openDebts = useMemo(() => debts.filter((d) => d.status !== 'pagada').sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [debts]);
  const paidDebts = useMemo(() => debts.filter((d) => d.status === 'pagada'), [debts]);
  const totalOpen = sum(openDebts.map((d) => d.amountUsd));
  const totalAll = sum(debts.map((d) => d.amountUsd));

  const byCreditor = useMemo(() => {
    const m = new Map<string, number>();
    openDebts.forEach((d) => m.set(d.creditor, (m.get(d.creditor) ?? 0) + d.amountUsd));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [openDebts]);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Deudas y cuotas</h1><p className="page-subtitle">Cashea, préstamos, cuotas de tiendas. Cada cuota es una fila con su vencimiento.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nueva cuota</button>
      </div>

      <div className="grid grid-3">
        <div className="card"><span className="field-label">Por pagar</span><Money amount={totalOpen} currency="USD" rate={currentRate} dual size="lg" /><ProgressBar ratio={totalAll ? 1 - totalOpen / totalAll : 0} color="var(--color-ok)" /><span className="tiny muted">{formatUsd(totalAll - totalOpen)} ya pagado</span></div>
        <div className="card">
          <span className="field-label">Por acreedor</span>
          <ul className="debt-creditors">{byCreditor.map(([c, v]) => <li key={c} className="row-between small"><span>{c}</span><span className="num strong">{formatUsd(v)}</span></li>)}</ul>
          {byCreditor.length === 0 && <span className="muted small">Sin deudas abiertas.</span>}
        </div>
        <div className="card">
          <span className="field-label">Próximos 30 días</span>
          <Money amount={sum(openDebts.filter((d) => daysBetween(today, d.dueDate) <= 30).map((d) => d.amountUsd))} currency="USD" rate={currentRate} dual size="lg" />
          <span className="tiny muted">Esto es lo que necesitas tener a la mano.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="card-title">Cuotas abiertas</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPaid((v) => !v)}>{showPaid ? 'Ocultar pagadas' : `Ver pagadas (${paidDebts.length})`}</button></div>
        {openDebts.length === 0 && !showPaid ? <EmptyState title="Sin deudas pendientes" hint="Buena señal. Registra aquí cualquier compra a cuotas para vigilar tu capacidad de endeudamiento." /> : (
          <ul>
            {(showPaid ? [...openDebts, ...paidDebts] : openDebts).map((d) => {
              const days = daysBetween(today, d.dueDate);
              const overdue = d.status !== 'pagada' && days < 0;
              return (
                <li key={d.id} className={`list-item${d.status === 'pagada' ? ' debt-paid' : ''}`}>
                  <div className="debt-date"><span className="tiny muted">{shortDate(d.dueDate)}</span></div>
                  <div className="grow">
                    <div className="strong truncate">{d.merchant}{d.installment && <span className="muted tiny"> · {d.installment}</span>}</div>
                    <div className="tiny muted">{d.creditor}{d.owner === 'tercero' && ' · de un tercero'}{d.description && ` · ${d.description}`}</div>
                  </div>
                  <span className={`tag ${d.status === 'pagada' ? 'ok' : overdue ? 'danger' : days <= 3 ? 'warn' : ''}`}>{d.status === 'pagada' ? 'Pagada' : overdue ? `Vencida ${-days} d` : days === 0 ? 'Hoy' : `${days} d`}</span>
                  <span className="num strong">{formatUsd(d.amountUsd)}</span>
                  {d.status !== 'pagada' && <button type="button" className="btn btn-ghost btn-icon" aria-label="Marcar pagada" onClick={() => update<Debt>('debts', d.id, { status: 'pagada' })}><Check size={16} /></button>}
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar cuota de ${d.merchant}?`)) void del('debts', d.id); }}><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal title="Nueva cuota" open={open} onClose={() => setOpen(false)}>
        <DebtForm onSubmit={async (rows) => { await Promise.all(rows.map((r) => add<Debt>('debts', r))); setOpen(false); }} />
      </Modal>
    </div>
  );
}

/** Permite crear N cuotas iguales de una vez (ej. Cashea 6 cuotas cada 14 días). */
function DebtForm({ onSubmit }: { onSubmit: (rows: NewDoc<Debt>[]) => Promise<void> }) {
  const [creditor, setCreditor] = useState('Cashea');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [installments, setInstallments] = useState('1');
  const [everyDays, setEveryDays] = useState('14');
  const [owner, setOwner] = useState<MoneyOwner>('propio');
  const [status, setStatus] = useState<PayStatus>('pendiente');

  const n = Math.max(1, Number(installments) || 1);
  const amt = Number(amountUsd) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!merchant || amt <= 0) return;
    const rows: NewDoc<Debt>[] = Array.from({ length: n }, (_, i) => {
      const d = new Date(dueDate);
      d.setDate(d.getDate() + i * (Number(everyDays) || 0));
      return {
        creditor, merchant, description: description || undefined, amountUsd: amt, owner,
        dueDate: d.toISOString().slice(0, 10), status: i === 0 ? status : 'pendiente',
        installment: n > 1 ? `${i + 1}/${n}` : undefined,
      };
    });
    await onSubmit(rows);
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Acreedor</span><input className="input" value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Cashea, Ubii, banco…" required /></label>
        <label className="field"><span className="field-label">Tienda / concepto</span><input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Miniso, Maraplus…" required /></label>
      </div>
      <label className="field"><span className="field-label">Descripción</span><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto por cuota ($)</span><input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Primer vencimiento</span><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Nº de cuotas</span><input className="input num" type="number" min="1" max="36" value={installments} onChange={(e) => setInstallments(e.target.value)} /></label>
        <label className="field"><span className="field-label">Cada (días)</span><input className="input num" type="number" min="1" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Dinero</span><select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}><option value="propio">Propio</option><option value="tercero">De un tercero</option></select></label>
        <label className="field"><span className="field-label">Estado de la 1ª cuota</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value as PayStatus)}>{(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
      </div>
      <p className="field-hint">Se crearán {n} cuota{n > 1 && 's'} por un total de <strong className="num">{formatUsd(amt * n)}</strong>.</p>
      <div className="form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
    </form>
  );
}
