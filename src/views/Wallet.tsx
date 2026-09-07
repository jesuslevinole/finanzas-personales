import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Pencil, Plus, TrendingUp } from 'lucide-react';
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
import type { WalletMove, WalletMoveKind } from '../types';
import { EMPTY_RANGE, inRange, type Range } from '../utils/range';
import { rateForDate } from '../utils/finance';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import { formatBs, formatPct, formatUsd, round2, sum, toBs } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Wallet.css';

const KIND_LABEL: Record<WalletMoveKind, string> = { entrada: 'Entrada', salida: 'Salida' };

export default function Wallet() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const editable = canEdit('divisas');

  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [kind, setKind] = useState<'' | WalletMoveKind>('');
  const [creating, setCreating] = useState(false);
  const [editingMove, setEditingMove] = useState<WalletMove | null>(null);
  const [detail, setDetail] = useState<WalletMove | null>(null);

  const all = data.walletMoves;
  const seq = useMemo(() => sequenceMap(all, (m) => m.date), [all]);
  const rows = useMemo(
    () => sortBySeqDesc(all, seq).filter((m) => inRange(m.date, range) && (!kind || m.kind === kind)),
    [all, seq, range, kind],
  );

  /* El saldo se calcula sobre TODO el histórico, no sobre el filtro. */
  const inUsd = sum(all.filter((m) => m.kind === 'entrada').map((m) => m.amountUsd));
  const outUsd = sum(all.filter((m) => m.kind === 'salida').map((m) => m.amountUsd));
  const balanceUsd = round2(inUsd - outUsd);

  const soldBs = sum(all.filter((m) => m.kind === 'salida').map((m) => m.amountBs));
  const avgSellRate = outUsd > 0 ? soldBs / outUsd : 0;
  /** Cuánto mejor vendiste que la tasa BCV de hoy. */
  const spread = data.currentRate > 0 && avgSellRate > 0 ? avgSellRate / data.currentRate - 1 : 0;

  const activeCount = [range.from, range.to, kind].filter(Boolean).length;

  const removeMove = async (move: WalletMove) => {
    const ok = await confirm({
      title: `¿Eliminar esta ${KIND_LABEL[move.kind].toLowerCase()}?`,
      message: `${formatUsd(move.amountUsd)} · ${move.concept}`,
      confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    await data.del('walletMoves', move.id);
    setDetail(null);
  };

  const columns: Column<WalletMove>[] = [
    { key: 'seq', header: '#', width: '54px', hideOnMobile: true, render: (m) => <span className="seq num">{seq.get(m.id)}</span> },
    { key: 'kind', header: '', width: '40px', leading: true, render: (m) => (
      <span className={`wallet-kind ${m.kind}`}>{m.kind === 'entrada' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span>
    ) },
    { key: 'concept', header: 'Concepto', primary: true, render: (m) => <span className="truncate">{m.concept}</span> },
    { key: 'date', header: 'Fecha', width: '110px', render: (m) => <span className="muted">{shortDate(m.date)}</span> },
    { key: 'rate', header: 'Tasa', width: '120px', hideOnMobile: true, render: (m) => <span className="num muted">{formatBs(m.rate)}</span> },
    { key: 'bs', header: 'Bolívares', width: '140px', hideOnMobile: true, render: (m) => <span className="num text-bs">{formatBs(m.amountBs)}</span> },
    { key: 'usd', header: 'USD', align: 'end', width: '110px', amount: true, render: (m) => (
      <span className={`num strong ${m.kind === 'entrada' ? 'text-ok' : 'text-danger'}`}>
        {m.kind === 'entrada' ? '+' : '−'}{formatUsd(m.amountUsd)}
      </span>
    ) },
  ];

  const exportPdf = () => runExport(() => ({
    title: 'Divisas',
    subtitle: `Saldo ${formatUsd(balanceUsd)} · ${all.length} movimientos`,
    fileName: 'divisas',
    cards: [
      { label: 'Saldo en dólares', value: formatUsd(balanceUsd), hint: formatBs(toBs(balanceUsd, data.currentRate)), tone: 'ok' as const },
      { label: 'Entradas', value: formatUsd(inUsd) },
      { label: 'Salidas', value: formatUsd(outUsd), hint: formatBs(soldBs) },
      { label: 'Tasa promedio de venta', value: avgSellRate > 0 ? formatBs(avgSellRate) : '—', hint: spread !== 0 ? `${formatPct(spread)} sobre BCV` : undefined },
    ],
    tables: [{
      title: 'Movimientos',
      head: ['Fecha', 'Tipo', 'Concepto', 'Tasa', 'Bolívares', 'USD'],
      body: rows.map((m) => [
        shortDate(m.date), KIND_LABEL[m.kind], m.concept,
        formatBs(m.rate), formatBs(m.amountBs),
        `${m.kind === 'entrada' ? '+' : '-'}${formatUsd(m.amountUsd)}`,
      ]),
      foot: [['', '', '', '', 'Saldo', formatUsd(balanceUsd)]],
      alignRight: [3, 4, 5],
    }],
    footNote: 'Las entradas son dólares que guardas; las salidas, dólares que cambias a bolívares para pagar.',
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Divisas</h1>
          <p className="page-subtitle">Lo que guardas en dólares y lo que cambias a bolívares para pagar. Tu colchón contra la inflación.</p>
        </div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo movimiento</button>}
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard tone="usd" icon={<Coins size={18} />} label="Saldo en dólares"
          value={<Money amount={balanceUsd} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${all.filter((m) => m.kind === 'entrada').length} entradas · ${all.filter((m) => m.kind === 'salida').length} salidas`} />
        <StatCard tone="ok" icon={<ArrowDownLeft size={18} />} label="Total guardado"
          value={<span className="num">{formatUsd(inUsd)}</span>} hint="Entradas del histórico" />
        <StatCard tone="bs" icon={<ArrowUpRight size={18} />} label="Cambiado a bolívares"
          value={<span className="num">{formatUsd(outUsd)}</span>} hint={formatBs(soldBs)} />
        <StatCard tone={spread > 0 ? 'ok' : 'warn'} icon={<TrendingUp size={18} />} label="Tasa promedio de venta"
          value={<span className="num">{avgSellRate > 0 ? formatBs(avgSellRate) : '—'}</span>}
          hint={avgSellRate > 0 ? `${formatPct(spread)} respecto al BCV de hoy` : 'Sin salidas registradas'} />
      </div>

      <FilterBar activeCount={activeCount} onClear={() => { setRange(EMPTY_RANGE); setKind(''); }}>
        <DateRange value={range} onChange={setRange} />
        <label className="field"><span className="field-label">Tipo</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as '' | WalletMoveKind)}>
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>
        </label>
      </FilterBar>

      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} onRowClick={setDetail}
          actions={editable ? (m) => (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditingMove(m)}><Pencil size={15} /></button>
          ) : undefined}
          empty={<EmptyState title="Sin movimientos"
            hint="Registra cuándo guardas dólares y cuándo los cambias a bolívares, por ejemplo para pagar el alquiler." />} />
      </div>

      {detail && (
        <DetailSheet open title={detail.concept} subtitle={`${KIND_LABEL[detail.kind]} · ${shortDate(detail.date)}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditingMove(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => void removeMove(detail) : undefined}
          fields={[
            { label: 'Monto en dólares', value: <span className="num text-usd">{formatUsd(detail.amountUsd)}</span> },
            { label: 'Tasa aplicada', value: <span className="num">{formatBs(detail.rate)}</span> },
            { label: 'Bolívares', value: <span className="num text-bs">{formatBs(detail.amountBs)}</span> },
            { label: 'Contra BCV de hoy', value: data.currentRate > 0 ? formatPct(detail.rate / data.currentRate - 1) : '—' },
            { label: 'Gasto enlazado', value: detail.linkedExpenseId
              ? data.expenses.find((e) => e.id === detail.linkedExpenseId)?.product ?? 'El movimiento fue eliminado'
              : '—', wide: true },
            { label: 'Nota', value: detail.note ?? '—', wide: true },
          ]} />
      )}

      <Modal title="Nuevo movimiento" open={creating} onClose={() => setCreating(false)}>
        <WalletForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal title="Editar movimiento" open={editingMove !== null} onClose={() => setEditingMove(null)}>
        {editingMove && <WalletForm move={editingMove} onDone={() => setEditingMove(null)} />}
      </Modal>
    </div>
  );
}

function WalletForm({ move, onDone }: { move?: WalletMove; onDone: () => void }) {
  const data = useData();
  const [kind, setKind] = useState<WalletMoveKind>(move?.kind ?? 'entrada');
  const [date, setDate] = useState(move?.date ?? todayIso());
  const [amountUsd, setAmountUsd] = useState(move ? String(move.amountUsd) : '');
  const [rate, setRate] = useState(String(move?.rate ?? rateForDate(data.rates, todayIso(), data.currentRate)));
  const [concept, setConcept] = useState(move?.concept ?? '');
  const [note, setNote] = useState(move?.note ?? '');
  const [saving, setSaving] = useState(false);

  const usd = Number(amountUsd) || 0;
  const rateNum = Number(rate) || 0;
  const bs = round2(toBs(usd, rateNum));
  const vsBcv = data.currentRate > 0 && rateNum > 0 ? rateNum / data.currentRate - 1 : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (usd <= 0 || !concept.trim()) return;
    setSaving(true);
    const payload = { date, kind, amountUsd: usd, rate: rateNum, amountBs: bs, concept: concept.trim(), note: note.trim() || undefined };
    if (move) await data.update<WalletMove>('walletMoves', move.id, payload);
    else await data.add<WalletMove>('walletMoves', payload);
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="wallet-kind-picker" role="radiogroup" aria-label="Tipo de movimiento">
        <button type="button" role="radio" aria-checked={kind === 'entrada'} className={`wallet-kind-option${kind === 'entrada' ? ' selected entrada' : ''}`} onClick={() => setKind('entrada')}>
          <ArrowDownLeft size={16} /> Entrada
          <span className="tiny">Guardo dólares</span>
        </button>
        <button type="button" role="radio" aria-checked={kind === 'salida'} className={`wallet-kind-option${kind === 'salida' ? ' selected salida' : ''}`} onClick={() => setKind('salida')}>
          <ArrowUpRight size={16} /> Salida
          <span className="tiny">Cambio a bolívares</span>
        </button>
      </div>

      <label className="field"><span className="field-label">Concepto</span>
        <input className="input" value={concept} onChange={(e) => setConcept(e.target.value)}
          placeholder={kind === 'entrada' ? 'Ahorro del cobro, pago de cliente…' : 'Alquiler de septiembre, gastos del mes…'} required />
      </label>

      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); if (!move) setRate(String(rateForDate(data.rates, e.target.value, data.currentRate))); }} />
        </label>
        <label className="field"><span className="field-label">Monto en dólares</span>
          <input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required />
        </label>
      </div>

      <label className="field"><span className="field-label">Tasa aplicada (Bs/$)</span>
        <input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
        <span className="field-hint">
          {kind === 'salida' ? 'La tasa a la que vendiste en Binance, que suele ser más alta que el BCV.' : 'La tasa del día en que guardaste los dólares.'}
        </span>
      </label>

      <dl className="kv wallet-summary">
        <div><dt>Equivale a</dt><dd className="num text-bs">{formatBs(bs)}</dd></div>
        {vsBcv !== 0 && <div><dt>Contra BCV de hoy</dt><dd className={`num ${vsBcv > 0 ? 'text-ok' : 'text-danger'}`}>{formatPct(vsBcv)}</dd></div>}
      </dl>

      <label className="field"><span className="field-label">Nota</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{move ? 'Guardar cambios' : 'Registrar movimiento'}</button>
      </div>
    </form>
  );
}
