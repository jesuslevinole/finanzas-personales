import { useState, type FormEvent } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import type { FixedCost, NewDoc, PayStatus } from '../types';
import { formatUsd, sum } from '../utils/money';
import { addMonths, todayIso } from '../utils/dates';
import './FixedCosts.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };
const STATUS_TAG: Record<PayStatus, string> = { pendiente: 'warn', en_proceso: 'primary', pagada: 'ok' };

export default function FixedCosts() {
  const { currentRate, fixedCosts, add, update, del } = useData();
  const { month, prev, next, monthFixed } = useMonth();
  const [open, setOpen] = useState(false);

  const total = sum(monthFixed.map((f) => f.amountUsd));
  const pending = sum(monthFixed.filter((f) => f.status !== 'pagada').map((f) => f.amountUsd));
  const prevMonth = addMonths(month, -1);
  const prevCosts = fixedCosts.filter((f) => f.month === prevMonth);

  const markPaid = (f: FixedCost) => update<FixedCost>('fixedCosts', f.id, { status: 'pagada', paidDate: todayIso() });
  const copyFromPrev = async () => {
    if (!window.confirm(`¿Copiar los ${prevCosts.length} costos del mes anterior a este mes como pendientes?`)) return;
    await Promise.all(prevCosts.map((f) => add<FixedCost>('fixedCosts', { description: f.description, amountUsd: f.amountUsd, month, dueDay: f.dueDay, status: 'pendiente' })));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Costos fijos</h1><p className="page-subtitle">Alquiler, condominio, internet, seguros… en dólares para que no se muevan con la tasa.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="grid grid-3">
        <div className="card"><span className="field-label">Total del mes</span><Money amount={total} currency="USD" rate={currentRate} dual size="lg" /></div>
        <div className="card"><span className="field-label">Pendiente por pagar</span><Money amount={pending} currency="USD" rate={currentRate} dual size="lg" /></div>
        <div className="card fixed-actions">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nuevo costo</button>
          {monthFixed.length === 0 && prevCosts.length > 0 && <button type="button" className="btn btn-outline" onClick={copyFromPrev}><Copy size={16} /> Copiar del mes anterior</button>}
        </div>
      </div>

      <div className="card">
        {monthFixed.length === 0 ? <EmptyState title="Sin costos fijos este mes" hint="Cárgalos una vez y cópialos cada mes; así sabes cuánto necesitas sí o sí." /> : (
          <ul>
            {[...monthFixed].sort((a, b) => a.dueDay - b.dueDay).map((f) => (
              <li key={f.id} className="record">
                <span className="record-date fixed-day num">{String(f.dueDay).padStart(2, '0')}</span>
                <span className="record-main"><span className="record-title">{f.description}</span></span>
                <span className="record-meta">
                  <span className={`tag ${STATUS_TAG[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                  {f.reference && <span className="truncate">Ref. {f.reference}</span>}
                </span>
                <span className="record-amount num strong">{formatUsd(f.amountUsd)}</span>
                <span className="record-actions">
                  {f.status !== 'pagada' && <button type="button" className="btn btn-ghost btn-icon" aria-label="Marcar pagada" onClick={() => markPaid(f)}><Check size={16} /></button>}
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar «${f.description}»?`)) void del('fixedCosts', f.id); }}><Trash2 size={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal title="Nuevo costo fijo" open={open} onClose={() => setOpen(false)}>
        <FixedCostForm month={month} onSubmit={async (d) => { await add<FixedCost>('fixedCosts', d); setOpen(false); }} />
      </Modal>
    </div>
  );
}

function FixedCostForm({ month, onSubmit }: { month: string; onSubmit: (d: NewDoc<FixedCost>) => Promise<void> }) {
  const [description, setDescription] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [reference, setReference] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amountUsd);
    if (!description || amt <= 0) return;
    await onSubmit({ description, amountUsd: amt, month, dueDay: Number(dueDay) || 1, status: 'pendiente', reference: reference || undefined });
  };

  return (
    <form onSubmit={submit} className="stack">
      <label className="field"><span className="field-label">Descripción</span><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Alquiler, condominio, internet…" required /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto en $</span><input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Día de pago</span><input className="input num" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></label>
      </div>
      <label className="field"><span className="field-label">Referencia (opcional)</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      <div className="form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
    </form>
  );
}
