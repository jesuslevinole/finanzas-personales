import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Copy, Pencil, PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import MonthPicker from '../components/ui/MonthPicker';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/ui/StatCard';
import DataTable, { type Column } from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ExportButton from '../components/ui/ExportButton';
import { useExport } from '../hooks/useExport';
import type { Budget } from '../types';
import { categoryTargets, groupTargets, GROUP_LABEL, ownIncomeUsd } from '../utils/finance';
import { addMonths, monthLabel } from '../utils/dates';
import { formatBs, formatPct, formatUsd, sum, toBs } from '../utils/money';
import './Budgets.css';

interface BudgetRow {
  id: string;
  name: string;
  color: string;
  group: string;
  limitUsd: number;
  /** true si el tope lo escribiste tú; false si es el sugerido por %. */
  isOwn: boolean;
  spentUsd: number;
  diffUsd: number;
  ratio: number;
}

const barColor = (ratio: number): string =>
  (ratio >= 1 ? 'var(--color-danger)' : ratio >= 0.8 ? 'var(--color-warn)' : 'var(--color-ok)');

export default function Budgets() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const { month, prev, next, monthIncomes, monthExpenses, monthDebts } = useMonth();
  const editable = canEdit('presupuesto');
  const [editing, setEditing] = useState<BudgetRow | null>(null);

  const settings = data.settingsFor(month);
  const incomeUsd = ownIncomeUsd(monthIncomes);
  const monthBudgets = useMemo(() => data.budgets.filter((b) => b.month === month), [data.budgets, month]);
  const groups = groupTargets(incomeUsd, monthExpenses, monthDebts.filter((d) => d.status === 'pagada'), data.categories, settings);
  const targets = categoryTargets(incomeUsd, monthExpenses, monthBudgets, data.categories);

  const rows: BudgetRow[] = useMemo(() => data.categories.map((cat) => {
    const target = targets.find((t) => t.categoryId === cat.id);
    const spentUsd = target?.actualUsd ?? 0;
    const own = monthBudgets.find((b) => b.categoryId === cat.id);
    const limitUsd = own?.limitUsd ?? target?.suggestedUsd ?? 0;
    return {
      id: cat.id, name: cat.name, color: cat.color, group: GROUP_LABEL[cat.group],
      limitUsd, isOwn: own !== undefined, spentUsd,
      diffUsd: limitUsd - spentUsd,
      ratio: limitUsd > 0 ? spentUsd / limitUsd : 0,
    };
  }).sort((a, b) => b.spentUsd - a.spentUsd), [data.categories, targets, monthBudgets]);

  const totalBudget = sum(rows.filter((r) => r.limitUsd > 0).map((r) => r.limitUsd));
  const totalSpent = sum(rows.map((r) => r.spentUsd));
  const withBudget = rows.filter((r) => r.isOwn).length;
  const overBudget = rows.filter((r) => r.isOwn && r.spentUsd > r.limitUsd);

  const prevMonth = addMonths(month, -1);
  const prevBudgets = data.budgets.filter((b) => b.month === prevMonth);

  const copyFromPrev = async () => {
    const ok = await confirm({
      title: 'Copiar presupuesto anterior',
      message: `Se copiarán ${prevBudgets.length} topes de ${monthLabel(prevMonth)} a este mes.`,
      confirmLabel: 'Copiar',
    });
    if (!ok) return;
    await Promise.all(prevBudgets.map((b) => {
      const existing = monthBudgets.find((x) => x.categoryId === b.categoryId);
      return existing
        ? data.update<Budget>('budgets', existing.id, { limitUsd: b.limitUsd })
        : data.add<Budget>('budgets', { categoryId: b.categoryId, month, limitUsd: b.limitUsd });
    }));
  };

  const exportPdf = () => runExport(() => ({
    title: 'Presupuesto',
    subtitle: `${monthLabel(month)} · ingreso ${formatUsd(incomeUsd)}`,
    fileName: 'presupuesto',
    cards: [
      { label: 'Presupuestado', value: formatUsd(totalBudget), hint: `${withBudget} rubros con tope` },
      { label: 'Gastado', value: formatUsd(totalSpent), hint: totalBudget > 0 ? formatPct(totalSpent / totalBudget) : undefined },
      { label: 'Disponible', value: formatUsd(totalBudget - totalSpent), tone: totalBudget - totalSpent < 0 ? 'danger' as const : 'ok' as const },
      { label: 'Rubros excedidos', value: String(overBudget.length), tone: overBudget.length ? 'danger' as const : 'ok' as const },
    ],
    bars: {
      title: 'Gasto por rubro',
      items: rows.filter((r) => r.spentUsd > 0).map((r) => ({
        label: r.name, value: r.spentUsd, display: formatUsd(r.spentUsd),
        note: r.limitUsd > 0 ? formatPct(r.ratio) : undefined,
      })),
    },
    tables: [
      {
        title: 'Reparto del ingreso',
        head: ['Grupo', 'Objetivo', 'Real', 'Diferencia'],
        body: groups.map((g) => [
          GROUP_LABEL[g.group], formatUsd(g.targetUsd), formatUsd(g.actualUsd),
          `${g.diffUsd < 0 ? 'Excedido ' : 'Libre '}${formatUsd(Math.abs(g.diffUsd))}`,
        ]),
        alignRight: [1, 2, 3],
      },
      {
        title: 'Por rubro',
        head: ['Rubro', 'Grupo', 'Presupuestado', 'Gastado', 'Diferencia'],
        body: rows.map((r) => [
          r.name, r.group,
          r.limitUsd > 0 ? `${formatUsd(r.limitUsd)}${r.isOwn ? '' : ' (sug.)'}` : 'Sin tope',
          formatUsd(r.spentUsd),
          r.limitUsd > 0 ? `${r.diffUsd < 0 ? '−' : ''}${formatUsd(Math.abs(r.diffUsd))}` : '—',
        ]),
        foot: [['', 'Total', formatUsd(totalBudget), formatUsd(totalSpent), formatUsd(totalBudget - totalSpent)]],
        alignRight: [2, 3, 4],
      },
    ],
  }));

  const columns: Column<BudgetRow>[] = [
    { key: 'color', header: '', width: '32px', leading: true, render: (r) => <span className="dot" style={{ '--dot-color': r.color } as CSSProperties} /> },
    { key: 'name', header: 'Rubro', primary: true, render: (r) => <span className="truncate">{r.name}</span> },
    { key: 'group', header: 'Grupo', width: '140px', hideOnMobile: true, render: (r) => <span className="muted">{r.group}</span> },
    { key: 'limit', header: 'Presupuestado', width: '150px', render: (r) => (
      r.limitUsd > 0
        ? <span className="num">{formatUsd(r.limitUsd)}{!r.isOwn && <span className="tiny muted"> sugerido</span>}</span>
        : <span className="tiny muted">Sin tope</span>
    ) },
    { key: 'spent', header: 'Gastado', width: '130px', render: (r) => <span className="num">{formatUsd(r.spentUsd)}</span> },
    { key: 'progress', header: 'Avance', width: '160px', hideOnMobile: true, render: (r) => (
      r.limitUsd > 0
        ? <span className="budget-progress"><ProgressBar ratio={r.ratio} color={barColor(r.ratio)} /><span className="tiny muted num">{formatPct(r.ratio)}</span></span>
        : <span className="tiny muted">—</span>
    ) },
    { key: 'diff', header: 'Diferencia', align: 'end', width: '140px', amount: true, render: (r) => {
      if (r.limitUsd <= 0) return <span className="muted">—</span>;
      return <span className={`num strong ${r.diffUsd < 0 ? 'text-danger' : 'text-ok'}`}>{r.diffUsd < 0 ? `−${formatUsd(-r.diffUsd)}` : formatUsd(r.diffUsd)}</span>;
    } },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Presupuesto</h1><p className="page-subtitle">Fija cuánto quieres gastar en cada rubro este mes y compáralo con lo que llevas.</p></div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          <MonthPicker month={month} onPrev={prev} onNext={next} />
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard tone="primary" icon={<Target size={18} />} label="Presupuestado"
          value={<span className="num">{formatUsd(totalBudget)}</span>}
          hint={`${withBudget} rubros con tope propio`} />
        <StatCard tone="bs" icon={<Wallet size={18} />} label="Gastado"
          value={<span className="num">{formatUsd(totalSpent)}</span>}
          hint={totalBudget > 0 ? `${formatPct(totalSpent / totalBudget)} del presupuesto` : 'Sin topes definidos'} />
        <StatCard tone={totalBudget - totalSpent < 0 ? 'danger' : 'ok'} icon={<PiggyBank size={18} />} label="Disponible"
          value={<span className={`num ${totalBudget - totalSpent < 0 ? 'text-danger' : ''}`}>{formatUsd(totalBudget - totalSpent)}</span>}
          hint={formatBs(toBs(Math.max(0, totalBudget - totalSpent), data.currentRate))} />
        <StatCard tone={overBudget.length ? 'danger' : 'ok'} icon={<TrendingDown size={18} />} label="Rubros excedidos"
          value={<span className="num">{overBudget.length}</span>}
          hint={overBudget.length ? overBudget.map((r) => r.name).slice(0, 2).join(', ') : 'Todo dentro del tope'} />
      </div>

      {incomeUsd === 0 && <div className="card budget-note">Registra ingresos propios de este mes para que los topes sugeridos se calculen sobre tu dinero real.</div>}

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Reparto {settings.split.necesidad}/{settings.split.deseo}/{settings.split.ahorro}</h2>
          <span className="tag primary">Ingreso: {formatUsd(incomeUsd)}</span>
        </div>
        <div className="grid grid-3">
          {groups.map((g) => {
            const ratio = g.targetUsd > 0 ? g.actualUsd / g.targetUsd : 0;
            return (
              <div key={g.group} className="budget-group">
                <div className="row-between"><span className="strong">{GROUP_LABEL[g.group]}</span><span className="tiny muted">{g.targetPct}%</span></div>
                <ProgressBar ratio={ratio} color={barColor(ratio)} />
                <div className="row-between tiny">
                  <span className="num">{formatUsd(g.actualUsd)} de {formatUsd(g.targetUsd)}</span>
                  <span className={`num ${g.diffUsd < 0 ? 'text-danger' : 'text-ok'}`}>{g.diffUsd < 0 ? 'Excedido ' : 'Libre '}{formatUsd(Math.abs(g.diffUsd))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {editable && prevBudgets.length > 0 && (
        <button type="button" className="btn btn-outline" onClick={copyFromPrev}>
          <Copy size={16} /> Copiar los {prevBudgets.length} topes de {monthLabel(prevMonth)}
        </button>
      )}

      <div className="card card-tight">
        <div className="card-header budget-table-head">
          <h2 className="card-title">Por rubro</h2>
          <span className="tiny muted">Toca un rubro para fijar su tope</span>
        </div>
        <DataTable rows={rows} columns={columns} onRowClick={editable ? setEditing : undefined}
          actions={editable ? (r) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Fijar tope" onClick={() => setEditing(r)}><Pencil size={15} /></button> : undefined}
          rowClass={(r) => (r.isOwn && r.spentUsd > r.limitUsd ? 'danger-row' : '')}
          empty={<EmptyState title="Sin rubros" hint="Crea rubros en Catálogos para poder presupuestarlos." />} />
      </div>

      <Modal title={editing ? `Tope de ${editing.name}` : 'Tope'} open={editing !== null} onClose={() => setEditing(null)}>
        {editing && <BudgetForm row={editing} month={month} monthBudgets={monthBudgets} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function BudgetForm({ row, month, monthBudgets, onDone }: { row: BudgetRow; month: string; monthBudgets: Budget[]; onDone: () => void }) {
  const { add, update, del, currentRate } = useData();
  const [limit, setLimit] = useState(row.limitUsd > 0 ? String(Math.round(row.limitUsd * 100) / 100) : '');
  const value = Number(limit) || 0;
  const existing = monthBudgets.find((b) => b.categoryId === row.id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value > 0) {
      if (existing) await update<Budget>('budgets', existing.id, { limitUsd: value });
      else await add<Budget>('budgets', { categoryId: row.id, month, limitUsd: value });
    } else if (existing) {
      await del('budgets', existing.id);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <dl className="kv">
        <div><dt>Gastado este mes</dt><dd className="num">{formatUsd(row.spentUsd)}</dd></div>
        <div><dt>Tope actual</dt><dd className="num">{row.limitUsd > 0 ? `${formatUsd(row.limitUsd)}${row.isOwn ? '' : ' (sugerido)'}` : 'Sin tope'}</dd></div>
      </dl>
      <label className="field">
        <span className="field-label">Cuánto quieres gastar en {row.name} ($)</span>
        <input className="input num budget-amount" type="number" inputMode="decimal" step="1" min="0" autoFocus
          value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0 = sin tope" />
      </label>
      {value > 0 && (
        <p className="field-hint">
          Equivale a <strong className="num">{formatBs(toBs(value, currentRate))}</strong>.
          {row.spentUsd > 0 && ` Llevas ${formatPct(row.spentUsd / value)} usado.`}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">{value > 0 ? 'Guardar tope' : 'Quitar tope'}</button>
      </div>
    </form>
  );
}
