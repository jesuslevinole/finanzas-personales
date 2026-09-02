import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, CreditCard, Pencil, Plus, Wallet } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/ui/StatCard';
import CustomSelect from '../components/ui/CustomSelect';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DateRange from '../components/ui/DateRange';
import { EMPTY_RANGE, inRange, type Range } from '../utils/range';
import DetailSheet from '../components/ui/DetailSheet';
import type { Creditor, Debt, MoneyOwner, NewDoc, PayStatus } from '../types';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { cycleOf, inCycle } from '../utils/cycle';
import { formatUsd, sum } from '../utils/money';
import { addDays, daysBetween, shortDate, todayIso } from '../utils/dates';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import './Debts.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };

export default function Debts() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const editable = canEdit('deudas');
  const today = todayIso();
  const cycle = cycleOf(today);

  const [tab, setTab] = useState<'pendiente' | 'pagado' | 'acreedor'>('pendiente');
  const [creditorId, setCreditorId] = useState('');
  const [status, setStatus] = useState<'' | PayStatus>('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [detail, setDetail] = useState<Debt | null>(null);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [creating, setCreating] = useState(false);

  const activeCount = [creditorId, status, search, range.from, range.to].filter(Boolean).length;
  const clearFilters = () => { setCreditorId(''); setStatus(''); setSearch(''); setRange(EMPTY_RANGE); };

  const seq = useMemo(() => sequenceMap(data.debts, (d) => d.dueDate), [data.debts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortBySeqDesc(data.debts, seq)
      .filter((d) => (!creditorId || d.creditorId === creditorId)
        && (!status || d.status === status)
        && inRange(d.dueDate, range)
        && (!q || `${d.merchant} ${d.description ?? ''} ${getRelationName(data.creditors, d.creditorId, '')}`.toLowerCase().includes(q)));
  }, [data.debts, seq, data.creditors, creditorId, status, search, range]);

  const openRows = filtered.filter((d) => d.status !== 'pagada');
  const paidRows = filtered.filter((d) => d.status === 'pagada');
  const rows = tab === 'pagado' ? paidRows : openRows;
  const totalOpen = sum(openRows.map((d) => d.amountUsd));
  const totalAll = sum(filtered.map((d) => d.amountUsd));
  const thisCycle = sum(openRows.filter((d) => inCycle(d.dueDate, cycle)).map((d) => d.amountUsd));
  const overdue = sum(openRows.filter((d) => d.dueDate < today).map((d) => d.amountUsd));

  const byCreditor = useMemo(() => {
    const m = new Map<string, number>();
    openRows.forEach((d) => m.set(d.creditorId, (m.get(d.creditorId) ?? 0) + d.amountUsd));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [openRows]);

  const removeDebt = async (d: Debt) => {
    const ok = await confirm({ title: `¿Eliminar la cuota de ${d.merchant}?`, message: 'Se borra de forma permanente.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await data.del('debts', d.id);
    setDetail(null);
  };

  interface CreditorRow { id: string; name: string; color: string; total: number; count: number; overdue: number }

  const creditorRows: CreditorRow[] = useMemo(() => byCreditor.map(([id, total]) => ({
    id,
    name: getRelationName(data.creditors, id),
    color: getRelationColor(data.creditors, id),
    total,
    count: openRows.filter((d) => d.creditorId === id).length,
    overdue: sum(openRows.filter((d) => d.creditorId === id && d.dueDate < today).map((d) => d.amountUsd)),
  })), [byCreditor, data.creditors, openRows, today]);

  const creditorColumns: Column<CreditorRow>[] = [
    { key: 'color', header: '', width: '36px', leading: true, render: (r) => <span className="dot" style={{ '--dot-color': r.color } as CSSProperties} /> },
    { key: 'name', header: 'Acreedor', primary: true, render: (r) => <span className="truncate">{r.name}</span> },
    { key: 'count', header: 'Cuotas abiertas', width: '150px', render: (r) => <span className="num">{r.count}</span> },
    { key: 'overdue', header: 'Vencido', width: '130px', render: (r) => (
      r.overdue > 0 ? <span className="tag danger num">{formatUsd(r.overdue)}</span> : <span className="tag ok">Al día</span>
    ) },
    { key: 'total', header: 'Deuda abierta', align: 'end', width: '140px', amount: true, render: (r) => <span className="strong num">{formatUsd(r.total)}</span> },
  ];

  const columns: Column<Debt>[] = [
    { key: 'seq', header: '#', width: '54px', render: (d) => <span className="seq num">{seq.get(d.id)}</span> },
    { key: 'due', header: 'Vence', width: '100px', render: (d) => {
      const days = daysBetween(today, d.dueDate);
      const late = d.status !== 'pagada' && days < 0;
      return <span className={late ? 'text-danger strong' : 'muted'}>{shortDate(d.dueDate)}</span>;
    } },
    { key: 'merchant', header: 'Concepto', primary: true, render: (d) => (
      <span className="truncate">{d.merchant}{d.installment && <span className="tiny muted num"> {d.installment}</span>}</span>
    ) },
    { key: 'creditor', header: 'Acreedor', width: '150px', render: (d) => (
      <span className="tag cat truncate" style={{ '--tag-color': getRelationColor(data.creditors, d.creditorId) } as CSSProperties}>{getRelationName(data.creditors, d.creditorId)}</span>
    ) },
    { key: 'status', header: 'Estado', width: '130px', render: (d) => {
      const days = daysBetween(today, d.dueDate);
      if (d.status === 'pagada') return <span className="tag ok">Pagada</span>;
      if (days < 0) return <span className="tag danger">Vencida {-days} d</span>;
      if (days === 0) return <span className="tag warn">Hoy</span>;
      return <span className="tag">{days} d</span>;
    } },
    { key: 'amount', header: 'Monto', align: 'end', width: '110px', amount: true, render: (d) => <span className="strong num">{formatUsd(d.amountUsd)}</span> },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Deudas y cuotas</h1><p className="page-subtitle">Cashea, préstamos, cuotas de tiendas. Cada cuota es una fila con su vencimiento.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva cuota</button>}
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'pendiente'} className={`tab${tab === 'pendiente' ? ' active' : ''}`} onClick={() => setTab('pendiente')}>Pendientes <span className="num muted">{openRows.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'pagado'} className={`tab${tab === 'pagado' ? ' active' : ''}`} onClick={() => setTab('pagado')}>Pagadas <span className="num muted">{paidRows.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'acreedor'} className={`tab${tab === 'acreedor' ? ' active' : ''}`} onClick={() => setTab('acreedor')}>Por acreedor <span className="num muted">{byCreditor.length}</span></button>
      </div>

      <div className="grid grid-4">
        <StatCard tone={overdue > 0 ? 'danger' : 'primary'} icon={<CreditCard size={18} />} label="Por pagar"
          value={<Money amount={totalOpen} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${openRows.length} cuotas abiertas`} />
        <StatCard tone="warn" icon={<Wallet size={18} />} label="Vence esta semana de cobro"
          value={<span className="num">{formatUsd(thisCycle)}</span>} hint={cycle.label} />
        <StatCard tone={overdue > 0 ? 'danger' : 'ok'} icon={<CreditCard size={18} />} label="Vencido"
          value={<span className={`num ${overdue > 0 ? 'text-danger' : ''}`}>{formatUsd(overdue)}</span>} hint="Atiéndelo primero" />
        <StatCard tone="ok" icon={<Check size={18} />} label="Ya pagado"
          value={<span className="num">{formatUsd(totalAll - totalOpen)}</span>}
          hint={<ProgressBar ratio={totalAll ? 1 - totalOpen / totalAll : 0} color="var(--color-ok)" />} />
      </div>

      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <DateRange value={range} onChange={setRange} label="Vencimiento entre" />
        <label className="field filterbar-wide"><span className="field-label">Buscar</span>
          <input className="input" placeholder="Tienda, descripción o acreedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="field"><span className="field-label">Acreedor</span>
          <select className="input" value={creditorId} onChange={(e) => setCreditorId(e.target.value)}>
            <option value="">Todos</option>
            {data.creditors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as '' | PayStatus)}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      </FilterBar>

      {tab === 'acreedor' ? (
        <div className="card card-tight">
          <DataTable rows={creditorRows} columns={creditorColumns} onRowClick={(r) => { setCreditorId(r.id); setTab('pendiente'); }}
            empty={<EmptyState title="Sin deuda abierta" hint="No hay cuotas pendientes con ningún acreedor." />} />
        </div>
      ) : (
      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} onRowClick={setDetail}
          actions={editable ? (d) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditing(d)}><Pencil size={15} /></button> : undefined}
          rowClass={(d) => (d.status === 'pagada' ? 'muted-row' : d.dueDate < today ? 'danger-row' : '')}

          empty={<EmptyState title={tab === 'pendiente' ? 'Sin cuotas pendientes' : 'Sin cuotas pagadas'} hint={activeCount > 0 ? 'Ninguna cuota coincide con los filtros.' : tab === 'pendiente' ? 'Buena señal: no hay cuotas abiertas.' : 'Aquí quedará el histórico de lo que vayas pagando.'} />} />
      </div>
      )}

      {detail && (
        <DetailSheet open title={detail.merchant} subtitle={`${getRelationName(data.creditors, detail.creditorId)} · vence ${shortDate(detail.dueDate)}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => void removeDebt(detail) : undefined}
          fields={[
            { label: 'Monto', value: <span className="num text-usd">{formatUsd(detail.amountUsd)}</span> },
            { label: 'Equivale hoy', value: <span className="num">{formatUsd(detail.amountUsd)} · Bs {(detail.amountUsd * data.currentRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span> },
            { label: 'Estado', value: STATUS_LABEL[detail.status] },
            { label: 'Cuota', value: detail.installment ?? 'Única' },
            { label: 'Dinero', value: detail.owner },
            { label: 'Referencia', value: detail.reference ?? '—' },
            { label: 'Descripción', value: detail.description ?? '—', wide: true },
          ]}>
          {editable && detail.status !== 'pagada' && (
            <button type="button" className="btn btn-outline btn-block" onClick={() => { void data.update<Debt>('debts', detail.id, { status: 'pagada' }); setDetail(null); }}>
              <Check size={16} /> Marcar como pagada
            </button>
          )}
        </DetailSheet>
      )}

      <Modal title="Nueva cuota" open={creating} onClose={() => setCreating(false)}>
        <DebtForm creditors={data.creditors}
          onCreateCreditor={(name) => data.add<Creditor>('creditors', { name, color: colorForIndex(data.creditors.length), active: true })}
          onSubmit={async (rows2) => { await Promise.all(rows2.map((r) => data.add<Debt>('debts', r))); setCreating(false); }} />
      </Modal>
      <Modal title="Editar cuota" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <DebtForm debt={editing} creditors={data.creditors}
            onCreateCreditor={(name) => data.add<Creditor>('creditors', { name, color: colorForIndex(data.creditors.length), active: true })}
            onSubmit={async (rows2) => { await data.update<Debt>('debts', editing.id, rows2[0]); setEditing(null); }} />
        )}
      </Modal>
    </div>
  );
}

interface DebtFormProps {
  debt?: Debt;
  creditors: Creditor[];
  onCreateCreditor: (name: string) => Promise<string>;
  onSubmit: (rows: NewDoc<Debt>[]) => Promise<void>;
}

/** Crea N cuotas iguales de una vez (Cashea: 6 cuotas cada 14 días). Al editar, solo una. */
function DebtForm({ debt, creditors, onCreateCreditor, onSubmit }: DebtFormProps) {
  const [creditorId, setCreditorId] = useState(debt?.creditorId ?? creditors[0]?.id ?? '');
  const [merchant, setMerchant] = useState(debt?.merchant ?? '');
  const [description, setDescription] = useState(debt?.description ?? '');
  const [amountUsd, setAmountUsd] = useState(debt ? String(debt.amountUsd) : '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? todayIso());
  const [installments, setInstallments] = useState('1');
  const [everyDays, setEveryDays] = useState('14');
  const [owner, setOwner] = useState<MoneyOwner>(debt?.owner ?? 'propio');
  const [status, setStatus] = useState<PayStatus>(debt?.status ?? 'pendiente');

  const n = debt ? 1 : Math.max(1, Number(installments) || 1);
  const amt = Number(amountUsd) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!merchant || !creditorId || amt <= 0) return;
    const rows: NewDoc<Debt>[] = Array.from({ length: n }, (_, i) => {
      const step = debt ? 0 : Number(everyDays) || 0;
      return {
        creditorId, merchant, description: description || undefined, amountUsd: amt, owner,
        dueDate: addDays(dueDate, i * step), status: i === 0 ? status : 'pendiente',
        installment: n > 1 ? `${i + 1}/${n}` : debt?.installment,
        reference: debt?.reference,
      };
    });
    await onSubmit(rows);
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <div className="field"><span className="field-label">Acreedor</span><CustomSelect items={creditors} value={creditorId} onChange={setCreditorId} onCreate={onCreateCreditor} placeholder="Cashea, Ubii, banco…" /></div>
        <label className="field"><span className="field-label">Tienda / concepto</span><input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Miniso, Maraplus…" required /></label>
      </div>
      <label className="field"><span className="field-label">Descripción</span><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto por cuota ($)</span><input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required /></label>
        <label className="field"><span className="field-label">{debt ? 'Vencimiento' : 'Primer vencimiento'}</span><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
      </div>
      {!debt && (
        <div className="form-grid">
          <label className="field"><span className="field-label">Nº de cuotas</span><input className="input num" type="number" min="1" max="36" value={installments} onChange={(e) => setInstallments(e.target.value)} /></label>
          <label className="field"><span className="field-label">Cada (días)</span><input className="input num" type="number" min="1" value={everyDays} onChange={(e) => setEveryDays(e.target.value)} /></label>
        </div>
      )}
      <div className="form-grid">
        <label className="field"><span className="field-label">Dinero</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}><option value="propio">Propio</option><option value="tercero">De un tercero</option></select>
        </label>
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PayStatus)}>
            {(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      {!debt && <p className="field-hint">Se crearán {n} cuota{n > 1 && 's'} por un total de <strong className="num">{formatUsd(amt * n)}</strong>.</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary">{debt ? 'Guardar cambios' : 'Guardar'}</button></div>
    </form>
  );
}
