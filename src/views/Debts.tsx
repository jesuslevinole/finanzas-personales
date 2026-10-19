import { useMemo, useState, type CSSProperties } from 'react';
import { Check, CreditCard, Layers, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/ui/StatCard';
import PayForm from '../components/forms/PayForm';
import DebtGroupForm from '../components/forms/DebtGroupForm';
import InstallmentForm from '../components/forms/InstallmentForm';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DateRange from '../components/ui/DateRange';
import { EMPTY_RANGE, inRange, type Range } from '../utils/range';
import DetailSheet from '../components/ui/DetailSheet';
import ExportButton from '../components/ui/ExportButton';
import { useExport } from '../hooks/useExport';
import type { Debt, DebtGroup, PayStatus } from '../types';
import { getRelationColor, getRelationName } from '../utils/relations';
import { cycleOf, inCycle } from '../utils/cycle';
import { formatUsd, sum } from '../utils/money';
import { daysBetween, shortDate, todayIso } from '../utils/dates';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import './Debts.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };

/**
 * Una fila de la tabla: una compra a cuotas (todas sus cuotas en un registro)
 * o una cuota suelta creada antes de agrupar.
 * `cuotas` son las que pasan los filtros; `all`, todas las de la compra.
 */
type DebtRecord =
  | { id: string; kind: 'group'; group: DebtGroup; cuotas: Debt[]; all: Debt[] }
  | { id: string; kind: 'single'; debt: Debt; cuotas: Debt[]; all: Debt[] };

const byDue = (a: Debt, b: Debt) => a.dueDate.localeCompare(b.dueDate);
const isOpen = (d: Debt) => d.status !== 'pagada';
/** Orden de la numeración: fecha de compra o, en cuotas sueltas, su vencimiento. */
const recordDate = (r: DebtRecord) => (r.kind === 'group' ? r.group.date : r.debt.dueDate);

export default function Debts() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const editable = canEdit('deudas');
  const today = todayIso();
  const cycle = cycleOf(today);

  const [tab, setTab] = useState<'pendiente' | 'pagado' | 'acreedor'>('pendiente');
  const [creditorId, setCreditorId] = useState('');
  const [status, setStatus] = useState<'' | PayStatus>('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  /** Se guarda el id (no el objeto) para que el detalle se actualice en vivo al pagar o editar. */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DebtGroup | null>(null);
  const [editingCuota, setEditingCuota] = useState<Debt | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  /** Detalle al que volver después de pagar o editar una cuota. */
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const activeCount = [creditorId, status, search, range.from, range.to].filter(Boolean).length;
  const clearFilters = () => { setCreditorId(''); setStatus(''); setSearch(''); setRange(EMPTY_RANGE); };

  const groupsById = useMemo(() => new Map(data.debtGroups.map((g) => [g.id, g])), [data.debtGroups]);
  const cuotasByGroup = useMemo(() => {
    const m = new Map<string, Debt[]>();
    data.debts.forEach((d) => { if (d.groupId) m.set(d.groupId, [...(m.get(d.groupId) ?? []), d]); });
    m.forEach((list) => list.sort(byDue));
    return m;
  }, [data.debts]);

  /** Cuotas que pasan los filtros. Los totales de arriba se calculan sobre ellas. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.debts.filter((d) => {
      if (creditorId && d.creditorId !== creditorId) return false;
      if (status && d.status !== status) return false;
      if (!inRange(d.dueDate, range)) return false;
      if (!q) return true;
      const g = d.groupId ? groupsById.get(d.groupId) : undefined;
      const extra = g ? `${g.invoiceNumber ?? ''} ${(g.items ?? []).map((i) => i.name).join(' ')}` : '';
      return `${d.merchant} ${d.description ?? ''} ${getRelationName(data.creditors, d.creditorId, '')} ${extra}`.toLowerCase().includes(q);
    });
  }, [data.debts, data.creditors, groupsById, creditorId, status, search, range]);

  const records = useMemo<DebtRecord[]>(() => {
    const out: DebtRecord[] = [];
    const grouped = new Map<string, Debt[]>();
    filtered.forEach((d) => {
      const g = d.groupId ? groupsById.get(d.groupId) : undefined;
      if (!g) { out.push({ id: `d:${d.id}`, kind: 'single', debt: d, cuotas: [d], all: [d] }); return; }
      grouped.set(g.id, [...(grouped.get(g.id) ?? []), d]);
    });
    grouped.forEach((cuotas, gid) => {
      const group = groupsById.get(gid) as DebtGroup;
      out.push({ id: `g:${gid}`, kind: 'group', group, cuotas: cuotas.sort(byDue), all: cuotasByGroup.get(gid) ?? cuotas });
    });
    return out;
  }, [filtered, groupsById, cuotasByGroup]);

  const seq = useMemo(() => sequenceMap(records, recordDate), [records]);
  const ordered = useMemo(() => sortBySeqDesc(records, seq), [records, seq]);

  const openRecords = ordered.filter((r) => r.cuotas.some(isOpen));
  const paidRecords = ordered.filter((r) => !r.cuotas.some(isOpen));
  const rows = tab === 'pagado' ? paidRecords : openRecords;

  const openRows = filtered.filter(isOpen);
  const totalOpen = sum(openRows.map((d) => d.amountUsd));
  const totalAll = sum(filtered.map((d) => d.amountUsd));
  const thisCycle = sum(openRows.filter((d) => inCycle(d.dueDate, cycle)).map((d) => d.amountUsd));
  const overdue = sum(openRows.filter((d) => d.dueDate < today).map((d) => d.amountUsd));

  interface CreditorRow { id: string; name: string; color: string; total: number; count: number; overdue: number }

  const creditorRows: CreditorRow[] = useMemo(() => {
    const m = new Map<string, number>();
    openRows.forEach((d) => m.set(d.creditorId, (m.get(d.creditorId) ?? 0) + d.amountUsd));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, total]) => ({
      id,
      name: getRelationName(data.creditors, id),
      color: getRelationColor(data.creditors, id),
      total,
      count: openRows.filter((d) => d.creditorId === id).length,
      overdue: sum(openRows.filter((d) => d.creditorId === id && d.dueDate < today).map((d) => d.amountUsd)),
    }));
  }, [openRows, data.creditors, today]);

  const creditorColumns: Column<CreditorRow>[] = [
    { key: 'color', header: '', width: '36px', leading: true, render: (r) => <span className="dot" style={{ '--dot-color': r.color } as CSSProperties} /> },
    { key: 'name', header: 'Acreedor', primary: true, render: (r) => <span className="truncate">{r.name}</span> },
    { key: 'count', header: 'Cuotas abiertas', width: '150px', render: (r) => <span className="num">{r.count}</span> },
    { key: 'overdue', header: 'Vencido', width: '130px', render: (r) => (
      r.overdue > 0 ? <span className="tag danger num">{formatUsd(r.overdue)}</span> : <span className="tag ok">Al día</span>
    ) },
    { key: 'total', header: 'Deuda abierta', align: 'end', width: '140px', amount: true, render: (r) => <span className="strong num">{formatUsd(r.total)}</span> },
  ];

  /* ---------- Acciones ---------- */

  const removeSingle = async (d: Debt) => {
    const ok = await confirm({ title: `¿Eliminar la cuota de ${d.merchant}?`, message: 'Se borra de forma permanente.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await data.del('debts', d.id);
    setDetailId(null);
  };

  const removeGroup = async (g: DebtGroup) => {
    const cuotas = cuotasByGroup.get(g.id) ?? [];
    const paid = cuotas.filter((d) => d.status === 'pagada').length;
    const ok = await confirm({
      title: `¿Eliminar la compra de ${g.merchant}?`,
      message: `Se borran la compra y sus ${cuotas.length} cuotas${paid ? ` (${paid} ya pagadas; los movimientos de esos pagos se conservan)` : ''}.`,
      confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    await Promise.all(cuotas.map((d) => data.del('debts', d.id)));
    await data.del('debtGroups', g.id);
    setDetailId(null);
  };

  const removeRecord = (r: DebtRecord) => (r.kind === 'group' ? removeGroup(r.group) : removeSingle(r.debt));
  const editRecord = (r: DebtRecord) => (r.kind === 'group' ? setEditingGroup(r.group) : setEditingCuota(r.debt));

  /** Abre pagar/editar una cuota desde el detalle y recuerda a qué detalle volver. */
  const fromDetail = (open: () => void) => { setReturnTo(detailId); setDetailId(null); open(); };
  const backToDetail = () => { setDetailId(returnTo); setReturnTo(null); };

  /** Qué movimiento saldó la cuota, para poder rastrear el pago. */
  const paymentLabel = (d: Debt): string => {
    if (!d.paidExpenseId) return d.status === 'pagada' ? 'Sin movimiento enlazado' : '—';
    const expense = data.expenses.find((e) => e.id === d.paidExpenseId);
    return expense ? `${expense.product} · ${shortDate(expense.date)} · ${formatUsd(expense.totalUsd)}` : 'El movimiento fue eliminado';
  };

  const statusTag = (d: Debt | undefined) => {
    if (!d) return <span className="tag ok">Pagada</span>;
    const days = daysBetween(today, d.dueDate);
    if (d.status === 'pagada') return <span className="tag ok">Pagada</span>;
    if (days < 0) return <span className="tag danger">Vencida {-days} d</span>;
    if (days === 0) return <span className="tag warn">Hoy</span>;
    return <span className="tag">{days} d</span>;
  };

  const exportPdf = () => runExport(() => ({
    title: 'Deudas y cuotas',
    subtitle: `${openRecords.length} compras con saldo · ${openRows.length} cuotas abiertas`,
    fileName: 'deudas',
    cards: [
      { label: 'Por pagar', value: formatUsd(totalOpen), hint: `${openRows.length} cuotas`, tone: 'danger' as const },
      { label: 'Vencido', value: formatUsd(overdue), tone: overdue > 0 ? 'danger' as const : 'ok' as const },
      { label: 'Vence esta semana', value: formatUsd(thisCycle), hint: cycle.label },
      { label: 'Ya pagado', value: formatUsd(totalAll - totalOpen), tone: 'ok' as const },
    ],
    bars: {
      title: 'Deuda abierta por acreedor',
      items: creditorRows.map((r) => ({ label: r.name, value: r.total, display: formatUsd(r.total), note: `${r.count} cuotas` })),
    },
    tables: [{
      title: 'Cuotas',
      head: ['Vence', 'Concepto', 'Acreedor', 'Estado', 'Monto'],
      body: [...filtered].sort(byDue).map((d) => [
        shortDate(d.dueDate),
        `${d.merchant}${d.installment ? ` (${d.installment})` : ''}`,
        getRelationName(data.creditors, d.creditorId),
        d.status === 'pagada' ? 'Pagada' : d.dueDate < today ? 'Vencida' : 'Pendiente',
        formatUsd(d.amountUsd),
      ]),
      foot: [['', '', '', 'Abierto', formatUsd(totalOpen)]],
      alignRight: [4],
    }],
  }));

  /* ---------- Tabla ---------- */

  const nextOpen = (r: DebtRecord) => r.cuotas.find(isOpen);
  const creditorOf = (r: DebtRecord) => (r.kind === 'group' ? r.group.creditorId : r.debt.creditorId);

  const columns: Column<DebtRecord>[] = [
    { key: 'seq', header: '#', width: '54px', render: (r) => <span className="seq num">{seq.get(r.id)}</span> },
    { key: 'due', header: tab === 'pagado' ? 'Último venc.' : 'Próximo venc.', width: '125px', render: (r) => {
      const next = nextOpen(r);
      const date = next?.dueDate ?? r.cuotas[r.cuotas.length - 1]?.dueDate ?? '';
      return <span className={next && next.dueDate < today ? 'text-danger strong' : 'muted'}>{date ? shortDate(date) : '—'}</span>;
    } },
    { key: 'merchant', header: 'Concepto', primary: true, render: (r) => (
      r.kind === 'group' ? (
        <span className="row debt-concept">
          <Layers size={14} className="text-primary" />
          <span className="truncate">{r.group.merchant}</span>
          {(r.group.items?.length ?? 0) > 0 && <span className="tag primary">{r.group.items?.length} prod.</span>}
        </span>
      ) : (
        <span className="truncate">{r.debt.merchant}{r.debt.installment && <span className="tiny muted num"> {r.debt.installment}</span>}</span>
      )
    ) },
    { key: 'creditor', header: 'Acreedor', width: '150px', render: (r) => (
      <span className="tag cat truncate" style={{ '--tag-color': getRelationColor(data.creditors, creditorOf(r)) } as CSSProperties}>{getRelationName(data.creditors, creditorOf(r))}</span>
    ) },
    { key: 'progress', header: 'Cuotas', width: '130px', hideOnMobile: true, render: (r) => {
      const paid = r.all.filter((d) => !isOpen(d)).length;
      return (
        <span className="debt-progress">
          <span className="tiny muted num">{paid}/{r.all.length} pagadas</span>
          <ProgressBar ratio={r.all.length ? paid / r.all.length : 0} color="var(--color-ok)" />
        </span>
      );
    } },
    { key: 'status', header: 'Estado', width: '130px', render: (r) => statusTag(nextOpen(r)) },
    { key: 'amount', header: tab === 'pagado' ? 'Pagado' : 'Pendiente', align: 'end', width: '120px', amount: true, render: (r) => {
      const amount = sum((tab === 'pagado' ? r.cuotas : r.cuotas.filter(isOpen)).map((d) => d.amountUsd));
      return <span className="strong num">{formatUsd(amount)}</span>;
    } },
  ];

  /* ---------- Detalle ---------- */

  const detailGroup = detailId?.startsWith('g:') ? groupsById.get(detailId.slice(2)) : undefined;
  const detailDebt = detailId?.startsWith('d:') ? data.debts.find((d) => d.id === detailId.slice(2)) : undefined;
  const detailCuotas = detailGroup ? cuotasByGroup.get(detailGroup.id) ?? [] : [];

  const renderGroupDetail = (g: DebtGroup) => {
    const paidSum = sum(detailCuotas.filter((d) => !isOpen(d)).map((d) => d.amountUsd));
    const openSum = sum(detailCuotas.filter(isOpen).map((d) => d.amountUsd));
    const paidCount = detailCuotas.filter((d) => !isOpen(d)).length;
    return (
      <DetailSheet open title={g.merchant}
        subtitle={`${getRelationName(data.creditors, g.creditorId)} · compra del ${shortDate(g.date)}${g.invoiceNumber ? ` · factura ${g.invoiceNumber}` : ''}`}
        onClose={() => setDetailId(null)}
        onEdit={editable ? () => { setEditingGroup(g); setDetailId(null); } : undefined}
        onDelete={editable ? () => void removeGroup(g) : undefined}
        fields={[
          { label: 'Total compra', value: <span className="num text-usd">{formatUsd(g.totalUsd)}</span> },
          { label: 'Pendiente', value: <Money amount={openSum} currency="USD" rate={data.currentRate} dual align="start" /> },
          { label: 'Pagado', value: <span className="num">{formatUsd(paidSum + (g.downPaymentUsd ?? 0))}{g.downPaymentUsd ? <span className="tiny muted"> (inicial {formatUsd(g.downPaymentUsd)})</span> : null}</span> },
          { label: 'Cuotas', value: `${paidCount} de ${detailCuotas.length} pagadas · cada ${g.everyDays} días` },
          { label: 'Dinero', value: g.owner },
          { label: 'Descripción', value: g.description || '—', wide: true },
        ]}>
        {(g.items?.length ?? 0) > 0 && (
          <section className="debt-section">
            <h3 className="field-label">Productos</h3>
            <ul className="debt-lines">
              {g.items?.map((it, i) => (
                <li key={`${it.name}-${i}`} className="debt-line">
                  <span className="truncate">{it.name}{it.quantity !== 1 && <span className="tiny muted num"> × {it.quantity}</span>}</span>
                  <span className="tiny muted num">{formatUsd(it.unitPriceUsd)} c/u</span>
                  <span className="num text-usd strong">{formatUsd(it.totalUsd)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="debt-section">
          <h3 className="field-label">Cuotas</h3>
          <ul className="debt-lines">
            {detailCuotas.map((d, i) => (
              <li key={d.id} className={`debt-cuota${d.status === 'pagada' ? ' paid' : ''}`}>
                <span className="seq num">{i + 1}</span>
                <span className="debt-cuota-main">
                  <span className="small">{shortDate(d.dueDate)}</span>
                  {d.status === 'pagada'
                    ? <span className="tag ok">Pagada{d.paidDate ? ` el ${shortDate(d.paidDate)}` : ''}</span>
                    : statusTag(d)}
                </span>
                <span className="num strong">{formatUsd(d.amountUsd)}</span>
                {editable && (
                  <span className="debt-cuota-actions">
                    {isOpen(d) && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => fromDetail(() => setPaying(d))}><Check size={14} /> Pagar</button>
                    )}
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar cuota ${i + 1}`} onClick={() => fromDetail(() => setEditingCuota(d))}><Pencil size={15} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </DetailSheet>
    );
  };

  const renderSingleDetail = (d: Debt) => (
    <DetailSheet open title={d.merchant} subtitle={`${getRelationName(data.creditors, d.creditorId)} · vence ${shortDate(d.dueDate)}`}
      onClose={() => setDetailId(null)}
      onEdit={editable ? () => { setEditingCuota(d); setDetailId(null); } : undefined}
      onDelete={editable ? () => void removeSingle(d) : undefined}
      fields={[
        { label: 'Monto', value: <span className="num text-usd">{formatUsd(d.amountUsd)}</span> },
        { label: 'Equivale hoy', value: <span className="num">{formatUsd(d.amountUsd)} · Bs {(d.amountUsd * data.currentRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span> },
        { label: 'Estado', value: STATUS_LABEL[d.status] },
        { label: 'Cuota', value: d.installment ?? 'Única' },
        { label: 'Dinero', value: d.owner },
        { label: 'Referencia', value: d.reference || '—' },
        { label: 'Pagada el', value: d.paidDate ? shortDate(d.paidDate) : '—' },
        { label: 'Movimiento del pago', value: paymentLabel(d) },
        { label: 'Descripción', value: d.description || '—', wide: true },
      ]}>
      {editable && isOpen(d) && (
        <button type="button" className="btn btn-outline btn-block" onClick={() => fromDetail(() => setPaying(d))}>
          <Check size={16} /> Registrar pago
        </button>
      )}
    </DetailSheet>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Deudas y cuotas</h1><p className="page-subtitle">Cashea, préstamos, cuotas de tiendas. Cada compra es un registro con sus productos y sus cuotas.</p></div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva compra a cuotas</button>}
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'pendiente'} className={`tab${tab === 'pendiente' ? ' active' : ''}`} onClick={() => setTab('pendiente')}>Pendientes <span className="num muted">{openRecords.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'pagado'} className={`tab${tab === 'pagado' ? ' active' : ''}`} onClick={() => setTab('pagado')}>Pagadas <span className="num muted">{paidRecords.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'acreedor'} className={`tab${tab === 'acreedor' ? ' active' : ''}`} onClick={() => setTab('acreedor')}>Por acreedor <span className="num muted">{creditorRows.length}</span></button>
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
          <input className="input" placeholder="Tienda, producto, factura o acreedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <DataTable rows={rows} columns={columns} onRowClick={(r) => setDetailId(r.id)}
            actions={editable ? (r) => (
              <>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => editRecord(r)}><Pencil size={15} /></button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => void removeRecord(r)}><Trash2 size={15} /></button>
              </>
            ) : undefined}
            rowClass={(r) => {
              const next = nextOpen(r);
              return !next ? 'muted-row' : next.dueDate < today ? 'danger-row' : '';
            }}
            empty={<EmptyState title={tab === 'pendiente' ? 'Sin deudas pendientes' : 'Sin compras pagadas'} hint={activeCount > 0 ? 'Ningún registro coincide con los filtros.' : tab === 'pendiente' ? 'Buena señal: no hay cuotas abiertas.' : 'Aquí quedará el histórico de lo que vayas pagando.'} />} />
        </div>
      )}

      {detailGroup && renderGroupDetail(detailGroup)}
      {detailDebt && renderSingleDetail(detailDebt)}

      <Modal title="Registrar pago" open={paying !== null} onClose={() => { setPaying(null); backToDetail(); }}>
        {paying && (
          <PayForm concept={`${paying.merchant}${paying.installment ? ` ${paying.installment}` : ''}`} amountUsd={paying.amountUsd}
            onPaid={async (expenseId, paidDate) => {
              await data.update<Debt>('debts', paying.id, { status: 'pagada', paidExpenseId: expenseId, paidDate });
              setPaying(null);
              backToDetail();
            }} />
        )}
      </Modal>

      <Modal title="Nueva compra a cuotas" open={creating} onClose={() => setCreating(false)}>
        {creating && <DebtGroupForm onDone={() => setCreating(false)} />}
      </Modal>
      <Modal title="Editar compra" open={editingGroup !== null} onClose={() => setEditingGroup(null)}>
        {editingGroup && (
          <DebtGroupForm group={editingGroup} installments={cuotasByGroup.get(editingGroup.id) ?? []} onDone={() => setEditingGroup(null)} />
        )}
      </Modal>
      <Modal title={editingCuota?.installment ? `Editar cuota ${editingCuota.installment}` : 'Editar cuota'} open={editingCuota !== null} onClose={() => { setEditingCuota(null); backToDetail(); }}>
        {editingCuota && <InstallmentForm debt={editingCuota} onDone={() => { setEditingCuota(null); backToDetail(); }} />}
      </Modal>
    </div>
  );
}
