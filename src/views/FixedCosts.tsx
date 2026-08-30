import { useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, Check, Copy, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import { usePermissions } from '../hooks/usePermissions';
import MonthPicker from '../components/ui/MonthPicker';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/ui/StatCard';
import DataTable, { type Column } from '../components/ui/DataTable';
import DetailSheet from '../components/ui/DetailSheet';
import ProgressBar from '../components/ui/ProgressBar';
import type { FixedCost, NewDoc, PayStatus } from '../types';
import { cycleOf, fixedCostDate, inCycle } from '../utils/cycle';
import { formatUsd, sum } from '../utils/money';
import { addMonths, shortDate, todayIso } from '../utils/dates';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import './FixedCosts.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };
const STATUS_TAG: Record<PayStatus, string> = { pendiente: 'warn', en_proceso: 'primary', pagada: 'ok' };

export default function FixedCosts() {
  const data = useData();
  const { canEdit } = usePermissions();
  const { month, prev, next, monthFixed } = useMonth();
  const editable = canEdit('costos-fijos');
  const today = todayIso();
  const cycle = cycleOf(today);

  const [tab, setTab] = useState<'pendiente' | 'pagado'>('pendiente');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [detail, setDetail] = useState<FixedCost | null>(null);

  const seq = useMemo(() => sequenceMap(data.fixedCosts, (f) => `${f.month}-${String(f.dueDay).padStart(2, '0')}`), [data.fixedCosts]);
  const all = useMemo(() => sortBySeqDesc(monthFixed, seq), [monthFixed, seq]);
  const pending = all.filter((f) => f.status !== 'pagada');
  const paid = all.filter((f) => f.status === 'pagada');
  const rows = tab === 'pendiente' ? pending : paid;
  const total = sum(all.map((f) => f.amountUsd));
  const pendingUsd = sum(pending.map((f) => f.amountUsd));
  const paidUsd = sum(paid.map((f) => f.amountUsd));
  const thisCycle = sum(pending.filter((f) => inCycle(fixedCostDate(f.month, f.dueDay), cycle)).map((f) => f.amountUsd));
  const prevMonth = addMonths(month, -1);
  const prevCosts = data.fixedCosts.filter((f) => f.month === prevMonth);

  const markPaid = (f: FixedCost) => data.update<FixedCost>('fixedCosts', f.id, { status: 'pagada', paidDate: today });
  const removeCost = (f: FixedCost) => {
    if (!window.confirm(`¿Eliminar «${f.description}»?`)) return;
    void data.del('fixedCosts', f.id);
    setDetail(null);
  };
  const copyFromPrev = async () => {
    if (!window.confirm(`¿Copiar los ${prevCosts.length} costos del mes anterior como pendientes?`)) return;
    await Promise.all(prevCosts.map((f) => data.add<FixedCost>('fixedCosts', { description: f.description, amountUsd: f.amountUsd, month, dueDay: f.dueDay, status: 'pendiente' })));
  };

  const columns: Column<FixedCost>[] = [
    { key: 'seq', header: '#', width: '54px', render: (f) => <span className="seq num">{seq.get(f.id)}</span> },
    { key: 'day', header: 'Día', width: '70px', render: (f) => <span className="fixed-day num">{String(f.dueDay).padStart(2, '0')}</span> },
    { key: 'description', header: 'Concepto', primary: true, render: (f) => <span className="truncate">{f.description}</span> },
    { key: 'status', header: 'Estado', width: '130px', render: (f) => <span className={`tag ${STATUS_TAG[f.status]}`}>{STATUS_LABEL[f.status]}</span> },
    { key: 'reference', header: 'Referencia', width: '130px', hideOnMobile: true, render: (f) => <span className="muted truncate">{f.reference ?? '—'}</span> },
    { key: 'amount', header: 'Monto', align: 'end', width: '130px', render: (f) => {
      const late = f.lateAmountUsd !== undefined && f.lateAfterDay !== undefined && f.status !== 'pagada' && Number(today.slice(8, 10)) > f.lateAfterDay;
      return (
        <span className="fixed-amount">
          <span className={`strong num${late ? ' text-danger' : ''}`}>{formatUsd(late ? f.lateAmountUsd! : f.amountUsd)}</span>
          {late && <span className="tiny text-danger">recargo aplicado</span>}
          {!late && f.lateAmountUsd !== undefined && <span className="tiny muted">sube a {formatUsd(f.lateAmountUsd)} tras el {f.lateAfterDay}</span>}
        </span>
      );
    } },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Costos fijos</h1><p className="page-subtitle">Alquiler, condominio, internet, seguros… en dólares, para que no se muevan con la tasa.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="grid grid-4">
        <StatCard tone="primary" icon={<CalendarClock size={18} />} label="Total del mes"
          value={<Money amount={total} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${rows.length} conceptos`} />
        <StatCard tone={pendingUsd > 0 ? 'warn' : 'ok'} icon={<Wallet size={18} />} label="Pendiente por pagar"
          value={<Money amount={pendingUsd} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${pending.length} sin pagar`} />
        <StatCard tone="bs" icon={<CalendarClock size={18} />} label="Cae esta semana de cobro"
          value={<span className="num">{formatUsd(thisCycle)}</span>} hint={cycle.label} />
        <StatCard tone="ok" icon={<Check size={18} />} label="Ya pagado"
          value={<span className="num">{formatUsd(paidUsd)}</span>}
          hint={<ProgressBar ratio={all.length ? paid.length / all.length : 0} color="var(--color-ok)" />} />
      </div>

      <div className="row-between wrap">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'pendiente'} className={`tab${tab === 'pendiente' ? ' active' : ''}`} onClick={() => setTab('pendiente')}>Pendientes <span className="num muted">{pending.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'pagado'} className={`tab${tab === 'pagado' ? ' active' : ''}`} onClick={() => setTab('pagado')}>Pagados <span className="num muted">{paid.length}</span></button>
        </div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo costo</button>}
        {editable && all.length === 0 && prevCosts.length > 0 && <button type="button" className="btn btn-outline" onClick={copyFromPrev}><Copy size={16} /> Copiar del mes anterior</button>}
      </div>

      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} onRowClick={setDetail}
          rowClass={(f) => (f.status === 'pagada' ? 'muted-row' : fixedCostDate(f.month, f.dueDay) < today ? 'danger-row' : '')}
          actions={editable ? (f) => (
            <>
              {f.status !== 'pagada' && <button type="button" className="btn btn-ghost btn-icon" aria-label="Marcar pagada" onClick={() => markPaid(f)}><Check size={15} /></button>}
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditing(f)}><Pencil size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => removeCost(f)}><Trash2 size={15} /></button>
            </>
          ) : undefined}
          empty={<EmptyState title={tab === 'pendiente' ? 'Nada pendiente' : 'Nada pagado aún'} hint={tab === 'pendiente' ? 'Todos los costos fijos del mes están pagados.' : 'Marca como pagados los que ya cubriste.'} />} />
      </div>

      {detail && (
        <DetailSheet open title={detail.description} subtitle={`Día ${detail.dueDay} · ${STATUS_LABEL[detail.status]}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => removeCost(detail) : undefined}
          fields={[
            { label: 'Monto', value: <span className="num text-usd">{formatUsd(detail.amountUsd)}</span> },
            { label: 'En bolívares hoy', value: <span className="num">{(detail.amountUsd * data.currentRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span> },
            { label: 'Mes', value: detail.month },
            { label: 'Pagado el', value: detail.paidDate ? shortDate(detail.paidDate) : '—' },
            { label: 'Referencia', value: detail.reference ?? '—' },
            { label: 'Recargo por atraso', value: detail.lateAmountUsd !== undefined ? `${formatUsd(detail.lateAmountUsd)} tras el día ${detail.lateAfterDay}` : '—' },
            { label: 'Nota', value: detail.note ?? '—', wide: true },
          ]} />
      )}

      <Modal title="Nuevo costo fijo" open={creating} onClose={() => setCreating(false)}>
        <FixedCostForm month={month} onSubmit={async (d) => { await data.add<FixedCost>('fixedCosts', d); setCreating(false); }} />
      </Modal>
      <Modal title="Editar costo fijo" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && <FixedCostForm month={month} cost={editing} onSubmit={async (d) => { await data.update<FixedCost>('fixedCosts', editing.id, d); setEditing(null); }} />}
      </Modal>
    </div>
  );
}

function FixedCostForm({ month, cost, onSubmit }: { month: string; cost?: FixedCost; onSubmit: (d: NewDoc<FixedCost>) => Promise<void> }) {
  const [description, setDescription] = useState(cost?.description ?? '');
  const [amountUsd, setAmountUsd] = useState(cost ? String(cost.amountUsd) : '');
  const [dueDay, setDueDay] = useState(String(cost?.dueDay ?? 1));
  const [reference, setReference] = useState(cost?.reference ?? '');
  const [lateAmountUsd, setLateAmountUsd] = useState(cost?.lateAmountUsd !== undefined ? String(cost.lateAmountUsd) : '');
  const [lateAfterDay, setLateAfterDay] = useState(cost?.lateAfterDay !== undefined ? String(cost.lateAfterDay) : '');
  const [note, setNote] = useState(cost?.note ?? '');
  const [status, setStatus] = useState<PayStatus>(cost?.status ?? 'pendiente');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amountUsd);
    if (!description || amt <= 0) return;
    await onSubmit({
      description, amountUsd: amt, month: cost?.month ?? month, dueDay: Number(dueDay) || 1,
      status, reference: reference || undefined, paidDate: status === 'pagada' ? cost?.paidDate ?? todayIso() : undefined,
      lateAmountUsd: Number(lateAmountUsd) || undefined,
      lateAfterDay: Number(lateAfterDay) || undefined,
      note: note || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="stack">
      <label className="field"><span className="field-label">Descripción</span><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Alquiler, condominio, internet…" required /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto en $</span><input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Día de pago</span><input className="input num" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PayStatus)}>
            {(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Referencia</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Sube a ($) si pagas tarde</span><input className="input num" type="number" step="0.01" min="0" value={lateAmountUsd} onChange={(e) => setLateAmountUsd(e.target.value)} placeholder="Opcional" /></label>
        <label className="field"><span className="field-label">Último día sin recargo</span><input className="input num" type="number" min="1" max="31" value={lateAfterDay} onChange={(e) => setLateAfterDay(e.target.value)} placeholder="Ej. 10" /></label>
      </div>
      <label className="field"><span className="field-label">Nota</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. se paga a tasa Binance" /></label>
      <div className="form-actions"><button type="submit" className="btn btn-primary">{cost ? 'Guardar cambios' : 'Guardar'}</button></div>
    </form>
  );
}
