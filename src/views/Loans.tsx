import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { CheckCircle2, Clock, HandCoins, Pencil, Plus, Users } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import { useExport } from '../hooks/useExport';
import StatCard from '../components/ui/StatCard';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DateRange from '../components/ui/DateRange';
import DetailSheet from '../components/ui/DetailSheet';
import Modal from '../components/ui/Modal';
import ExportButton from '../components/ui/ExportButton';
import EmptyState from '../components/ui/EmptyState';
import Money from '../components/ui/Money';
import ProgressBar from '../components/ui/ProgressBar';
import CustomSelect from '../components/ui/CustomSelect';
import type { Bank, Income, IncomeSource, Loan, LoanStatus, Person } from '../types';
import { EMPTY_RANGE, inRange, type Range } from '../utils/range';
import { rateForDate } from '../utils/finance';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import { formatBs, formatPct, formatUsd, round2, sum, toBs } from '../utils/money';
import { daysBetween, shortDate, todayIso } from '../utils/dates';
import './Loans.css';

const STATUS_LABEL: Record<LoanStatus, string> = { pendiente: 'Pendiente', parcial: 'Parcial', cobrado: 'Cobrado' };
const STATUS_TAG: Record<LoanStatus, string> = { pendiente: 'warn', parcial: 'primary', cobrado: 'ok' };

/** Lo que falta por cobrar de un préstamo. */
const pendingUsd = (loan: Loan): number => Math.max(0, round2(loan.amountUsd - loan.repaidUsd));

export default function Loans() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const editable = canEdit('prestamos');
  const today = todayIso();

  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [personId, setPersonId] = useState('');
  const [status, setStatus] = useState<'' | LoanStatus>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [detail, setDetail] = useState<Loan | null>(null);
  const [collecting, setCollecting] = useState<Loan | null>(null);

  const seq = useMemo(() => sequenceMap(data.loans, (l) => l.date), [data.loans]);
  const rows = useMemo(
    () => sortBySeqDesc(data.loans, seq).filter((l) =>
      inRange(l.date, range) && (!personId || l.personId === personId) && (!status || l.status === status)),
    [data.loans, seq, range, personId, status],
  );

  const open = data.loans.filter((l) => l.status !== 'cobrado');
  const outstanding = sum(open.map(pendingUsd));
  const lent = sum(data.loans.map((l) => l.amountUsd));
  const recovered = sum(data.loans.map((l) => l.repaidUsd));
  const overdue = open.filter((l) => l.dueDate && l.dueDate < today);

  const byPerson = useMemo(() => {
    const map = new Map<string, number>();
    open.forEach((l) => map.set(l.personId, (map.get(l.personId) ?? 0) + pendingUsd(l)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [open]);

  const activeCount = [range.from, range.to, personId, status].filter(Boolean).length;

  const removeLoan = async (loan: Loan) => {
    const ok = await confirm({
      title: `¿Eliminar el préstamo a ${getRelationName(data.people, loan.personId)}?`,
      message: `${formatUsd(loan.amountUsd)} del ${shortDate(loan.date)}.`,
      confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    await data.del('loans', loan.id);
    setDetail(null);
  };

  const columns: Column<Loan>[] = [
    { key: 'seq', header: '#', width: '54px', hideOnMobile: true, render: (l) => <span className="seq num">{seq.get(l.id)}</span> },
    { key: 'dot', header: '', width: '36px', leading: true, render: (l) => <span className="dot" style={{ '--dot-color': getRelationColor(data.people, l.personId) } as CSSProperties} /> },
    { key: 'person', header: 'Persona', primary: true, render: (l) => <span className="truncate">{getRelationName(data.people, l.personId, 'Sin persona')}</span> },
    { key: 'date', header: 'Prestado', width: '110px', render: (l) => <span className="muted">{shortDate(l.date)}</span> },
    { key: 'due', header: 'Acordado', width: '120px', hideOnMobile: true, render: (l) => {
      if (!l.dueDate) return <span className="muted">—</span>;
      const days = daysBetween(today, l.dueDate);
      if (l.status === 'cobrado') return <span className="muted">{shortDate(l.dueDate)}</span>;
      return <span className={days < 0 ? 'text-danger strong' : ''}>{days < 0 ? `Vencido ${-days} d` : shortDate(l.dueDate)}</span>;
    } },
    { key: 'status', header: 'Estado', width: '120px', render: (l) => <span className={`tag ${STATUS_TAG[l.status]}`}>{STATUS_LABEL[l.status]}</span> },
    { key: 'repaid', header: 'Devuelto', width: '120px', hideOnMobile: true, render: (l) => <span className="num muted">{formatUsd(l.repaidUsd)}</span> },
    { key: 'pending', header: 'Por cobrar', align: 'end', width: '120px', amount: true, render: (l) => (
      <span className={`num strong ${pendingUsd(l) > 0 ? 'text-danger' : 'text-ok'}`}>{formatUsd(pendingUsd(l))}</span>
    ) },
  ];

  const exportPdf = () => runExport(() => ({
    title: 'Préstamos',
    subtitle: `${open.length} abiertos · ${formatUsd(outstanding)} por cobrar`,
    fileName: 'prestamos',
    cards: [
      { label: 'Por cobrar', value: formatUsd(outstanding), hint: `${open.length} préstamos`, tone: 'danger' as const },
      { label: 'Total prestado', value: formatUsd(lent) },
      { label: 'Ya recuperado', value: formatUsd(recovered), tone: 'ok' as const },
      { label: 'Vencidos', value: String(overdue.length), tone: overdue.length ? 'danger' as const : 'ok' as const },
    ],
    bars: {
      title: 'Por cobrar según persona',
      items: byPerson.map(([id, usd]) => ({ label: getRelationName(data.people, id), value: usd, display: formatUsd(usd) })),
    },
    tables: [{
      title: 'Préstamos',
      head: ['Prestado', 'Persona', 'Concepto', 'Monto', 'Devuelto', 'Por cobrar', 'Estado'],
      body: rows.map((l) => [
        shortDate(l.date), getRelationName(data.people, l.personId), l.concept ?? '—',
        formatUsd(l.amountUsd), formatUsd(l.repaidUsd), formatUsd(pendingUsd(l)), STATUS_LABEL[l.status],
      ]),
      foot: [['', '', 'Totales', formatUsd(lent), formatUsd(recovered), formatUsd(outstanding), '']],
      alignRight: [3, 4, 5],
    }],
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Préstamos</h1>
          <p className="page-subtitle">El dinero que prestaste y sigue afuera. No es gasto, es dinero tuyo en manos de otro.</p>
        </div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo préstamo</button>}
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard tone={outstanding > 0 ? 'warn' : 'ok'} icon={<HandCoins size={18} />} label="Por cobrar"
          value={<Money amount={outstanding} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${open.length} préstamos abiertos`} />
        <StatCard tone="primary" icon={<Users size={18} />} label="Total prestado"
          value={<span className="num">{formatUsd(lent)}</span>} hint={`${data.loans.length} en total`} />
        <StatCard tone="ok" icon={<CheckCircle2 size={18} />} label="Ya recuperado"
          value={<span className="num">{formatUsd(recovered)}</span>}
          hint={<ProgressBar ratio={lent > 0 ? recovered / lent : 0} color="var(--color-ok)" />} />
        <StatCard tone={overdue.length ? 'danger' : 'ok'} icon={<Clock size={18} />} label="Pasados de fecha"
          value={<span className="num">{overdue.length}</span>}
          hint={overdue.length ? overdue.map((l) => getRelationName(data.people, l.personId)).slice(0, 2).join(', ') : 'Ninguno vencido'} />
      </div>

      <FilterBar activeCount={activeCount} onClear={() => { setRange(EMPTY_RANGE); setPersonId(''); setStatus(''); }}>
        <DateRange value={range} onChange={setRange} label="Prestado entre" />
        <label className="field"><span className="field-label">Persona</span>
          <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Todas</option>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as '' | LoanStatus)}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as LoanStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      </FilterBar>

      {byPerson.length > 0 && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Por cobrar según persona</h2></div>
          <ul className="kv loans-people">
            {byPerson.map(([id, usd]) => (
              <li key={id}>
                <span className="row"><span className="dot" style={{ '--dot-color': getRelationColor(data.people, id) } as CSSProperties} /><span className="truncate">{getRelationName(data.people, id)}</span></span>
                <span className="num strong">{formatUsd(usd)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} onRowClick={setDetail}
          rowClass={(l) => (l.status === 'cobrado' ? 'muted-row' : l.dueDate && l.dueDate < today ? 'danger-row' : '')}
          actions={editable ? (l) => (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditing(l)}><Pencil size={15} /></button>
          ) : undefined}
          empty={<EmptyState title="Sin préstamos" hint="Registra aquí el dinero que prestas para no perderle la pista." />} />
      </div>

      {detail && (
        <DetailSheet open title={getRelationName(data.people, detail.personId, 'Préstamo')}
          subtitle={`${shortDate(detail.date)} · ${STATUS_LABEL[detail.status]}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => void removeLoan(detail) : undefined}
          fields={[
            { label: 'Monto prestado', value: <span className="num text-usd">{formatUsd(detail.amountUsd)}</span> },
            { label: 'En bolívares', value: <span className="num text-bs">{formatBs(detail.amountBs)}</span> },
            { label: 'Devuelto', value: <span className="num">{formatUsd(detail.repaidUsd)}</span> },
            { label: 'Por cobrar', value: <span className="num text-danger">{formatUsd(pendingUsd(detail))}</span> },
            { label: 'Fecha acordada', value: detail.dueDate ? shortDate(detail.dueDate) : '—' },
            { label: 'Banco', value: detail.bankId ? getRelationName(data.banks, detail.bankId) : '—' },
            { label: 'Concepto', value: detail.concept ?? '—', wide: true },
            { label: 'Nota', value: detail.note ?? '—', wide: true },
          ]}>
          {editable && detail.status !== 'cobrado' && (
            <button type="button" className="btn btn-outline btn-block loans-detail-btn" onClick={() => { setCollecting(detail); setDetail(null); }}>
              <HandCoins size={16} /> Registrar cobro
            </button>
          )}
        </DetailSheet>
      )}

      <Modal title="Nuevo préstamo" open={creating} onClose={() => setCreating(false)}>
        <LoanForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal title="Editar préstamo" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && <LoanForm loan={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal title="Registrar cobro" open={collecting !== null} onClose={() => setCollecting(null)}>
        {collecting && <CollectForm loan={collecting} onDone={() => setCollecting(null)} />}
      </Modal>
    </div>
  );
}

function LoanForm({ loan, onDone }: { loan?: Loan; onDone: () => void }) {
  const data = useData();
  const [personId, setPersonId] = useState(loan?.personId ?? '');
  const [date, setDate] = useState(loan?.date ?? todayIso());
  const [amountUsd, setAmountUsd] = useState(loan ? String(loan.amountUsd) : '');
  const [rate, setRate] = useState(String(loan?.rate ?? rateForDate(data.rates, todayIso(), data.currentRate)));
  const [dueDate, setDueDate] = useState(loan?.dueDate ?? '');
  const [bankId, setBankId] = useState(loan?.bankId ?? '');
  const [concept, setConcept] = useState(loan?.concept ?? '');
  const [note, setNote] = useState(loan?.note ?? '');
  const [saving, setSaving] = useState(false);

  const usd = Number(amountUsd) || 0;
  const rateNum = Number(rate) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!personId || usd <= 0) return;
    setSaving(true);
    const payload = {
      personId, date, amountUsd: usd, rate: rateNum, amountBs: round2(toBs(usd, rateNum)),
      repaidUsd: loan?.repaidUsd ?? 0, status: loan?.status ?? ('pendiente' as LoanStatus),
      dueDate: dueDate || undefined, bankId: bankId || undefined,
      concept: concept.trim() || undefined, note: note.trim() || undefined,
    };
    if (loan) await data.update<Loan>('loans', loan.id, payload);
    else await data.add<Loan>('loans', payload);
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="field"><span className="field-label">Persona</span>
        <CustomSelect items={data.people} value={personId} onChange={setPersonId}
          onCreate={(name) => data.add<Person>('people', { name, color: colorForIndex(data.people.length), active: true })}
          placeholder="¿A quién le prestaste?" />
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha del préstamo</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); if (!loan) setRate(String(rateForDate(data.rates, e.target.value, data.currentRate))); }} />
        </label>
        <label className="field"><span className="field-label">Fecha acordada de pago</span>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto en dólares</span>
          <input className="input num" type="number" inputMode="decimal" step="any" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Tasa del día (Bs/$)</span>
          <input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
        </label>
      </div>
      <div className="field"><span className="field-label">Banco o medio</span>
        <CustomSelect items={data.banks} value={bankId} onChange={setBankId}
          onCreate={(name) => data.add<Bank>('banks', { name, color: colorForIndex(data.banks.length), active: true })}
          placeholder="Con qué se lo entregaste" />
      </div>
      <label className="field"><span className="field-label">Concepto</span>
        <input className="input" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Para medicinas, adelanto…" />
      </label>
      <label className="field"><span className="field-label">Nota</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="field-hint">Equivale a <strong className="num">{formatBs(toBs(usd, rateNum))}</strong> a la tasa indicada.</p>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving || !personId}>{loan ? 'Guardar cambios' : 'Registrar préstamo'}</button></div>
    </form>
  );
}

/** Registra una devolución, total o parcial, y opcionalmente la suma como ingreso. */
function CollectForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const data = useData();
  const pending = pendingUsd(loan);
  const [amountUsd, setAmountUsd] = useState(String(pending));
  const [date, setDate] = useState(todayIso());
  const [rate, setRate] = useState(String(rateForDate(data.rates, todayIso(), data.currentRate)));
  const [asIncome, setAsIncome] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [saving, setSaving] = useState(false);

  const usd = Number(amountUsd) || 0;
  const rateNum = Number(rate) || 0;
  const repaid = round2(loan.repaidUsd + usd);
  const nextStatus: LoanStatus = repaid >= loan.amountUsd - 0.005 ? 'cobrado' : 'parcial';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (usd <= 0) return;
    setSaving(true);
    try {
      await data.update<Loan>('loans', loan.id, { repaidUsd: repaid, status: nextStatus });
      if (asIncome && sourceId) {
        // El cobro no es ingreso nuevo: entra como dinero de tercero para no inflar el mes.
        await data.add<Income>('incomes', {
          date, sourceId, kind: 'variable', owner: 'tercero',
          amountBs: round2(toBs(usd, rateNum)), rate: rateNum, amountUsd: usd,
          note: `Devolución de préstamo a ${getRelationName(data.people, loan.personId)}`,
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <dl className="kv loans-summary">
        <div><dt>Prestado</dt><dd className="num">{formatUsd(loan.amountUsd)}</dd></div>
        <div><dt>Ya devuelto</dt><dd className="num">{formatUsd(loan.repaidUsd)}</dd></div>
        <div><dt>Falta</dt><dd className="num text-danger">{formatUsd(pending)}</dd></div>
      </dl>
      <div className="form-grid">
        <label className="field"><span className="field-label">Cuánto te devolvió ($)</span>
          <input className="input num loans-amount" type="number" inputMode="decimal" step="any" min="0" autoFocus
            value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Fecha</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); setRate(String(rateForDate(data.rates, e.target.value, data.currentRate))); }} />
        </label>
      </div>
      <label className="field"><span className="field-label">Tasa (Bs/$)</span>
        <input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
      </label>
      <label className="row small"><input type="checkbox" checked={asIncome} onChange={(e) => setAsIncome(e.target.checked)} /> Registrarlo también como movimiento de ingreso</label>
      {asIncome && (
        <div className="field"><span className="field-label">Origen del ingreso</span>
          <CustomSelect items={data.incomeSources} value={sourceId} onChange={setSourceId}
            onCreate={(name) => data.add<IncomeSource>('incomeSources', { name, color: colorForIndex(data.incomeSources.length), active: true })} />
          <span className="field-hint">Entra como dinero de tercero: es plata que ya era tuya, no un ingreso nuevo.</span>
        </div>
      )}
      <p className="field-hint">
        Quedaría en {formatUsd(repaid)} devueltos ({formatPct(loan.amountUsd > 0 ? repaid / loan.amountUsd : 0)}) y el préstamo pasa a <strong>{STATUS_LABEL[nextStatus]}</strong>.
      </p>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving || usd <= 0 || (asIncome && !sourceId)}>Registrar cobro</button></div>
    </form>
  );
}
