import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import { usePermissions } from '../hooks/usePermissions';
import MonthPicker from '../components/ui/MonthPicker';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DetailSheet from '../components/ui/DetailSheet';
import StatCard from '../components/ui/StatCard';
import ExpenseForm from '../components/forms/ExpenseForm';
import IncomeForm from '../components/forms/IncomeForm';
import type { Expense, Income, MoneyOwner } from '../types';
import { getRelationColor, getRelationName } from '../utils/relations';
import { formatBs, formatPct, formatUsd, sum } from '../utils/money';
import { shortDate } from '../utils/dates';
import './Movements.css';

type Tab = 'gastos' | 'ingresos';

export default function Movements() {
  const data = useData();
  const { canEdit } = usePermissions();
  const { month, prev, next, monthIncomes, monthExpenses } = useMonth();
  const [tab, setTab] = useState<Tab>('gastos');
  const editable = canEdit('movimientos');

  // Filtros
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [owner, setOwner] = useState<'' | MoneyOwner>('');
  const [minUsd, setMinUsd] = useState('');

  // Detalle y edición
  const [detail, setDetail] = useState<Expense | Income | null>(null);
  const [editing, setEditing] = useState<Expense | Income | null>(null);
  const [creating, setCreating] = useState(false);

  const clearFilters = () => { setSearch(''); setCategoryId(''); setPlaceId(''); setSourceId(''); setOwner(''); setMinUsd(''); };
  const activeCount = [search, categoryId, placeId, sourceId, owner, minUsd].filter(Boolean).length;

  const expenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = Number(minUsd) || 0;
    return monthExpenses.filter((e) =>
      (!q || `${e.product} ${getRelationName(data.places, e.placeId, '')} ${getRelationName(data.categories, e.categoryId, '')}`.toLowerCase().includes(q))
      && (!categoryId || e.categoryId === categoryId)
      && (!placeId || e.placeId === placeId)
      && (min <= 0 || e.totalUsd >= min));
  }, [monthExpenses, search, categoryId, placeId, minUsd, data.places, data.categories]);

  const incomes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = Number(minUsd) || 0;
    return monthIncomes.filter((i) =>
      (!q || `${getRelationName(data.incomeSources, i.sourceId, '')} ${i.note ?? ''}`.toLowerCase().includes(q))
      && (!sourceId || i.sourceId === sourceId)
      && (!owner || i.owner === owner)
      && (min <= 0 || i.amountUsd >= min));
  }, [monthIncomes, search, sourceId, owner, minUsd, data.incomeSources]);

  /* Totales del conjunto filtrado */
  const totalUsd = tab === 'gastos' ? sum(expenses.map((e) => e.totalUsd)) : sum(incomes.map((i) => i.amountUsd));
  const totalBs = tab === 'gastos' ? sum(expenses.map((e) => e.totalBs)) : sum(incomes.map((i) => i.amountBs));
  const count = tab === 'gastos' ? expenses.length : incomes.length;
  const allUsd = tab === 'gastos' ? sum(monthExpenses.map((e) => e.totalUsd)) : sum(monthIncomes.map((i) => i.amountUsd));
  const topGroup = useMemo(() => {
    const map = new Map<string, number>();
    if (tab === 'gastos') expenses.forEach((e) => map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.totalUsd));
    else incomes.forEach((i) => map.set(i.sourceId, (map.get(i.sourceId) ?? 0) + i.amountUsd));
    const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return { name: getRelationName(tab === 'gastos' ? data.categories : data.incomeSources, top[0]), usd: top[1] };
  }, [tab, expenses, incomes, data.categories, data.incomeSources]);

  const removeRecord = (row: Expense | Income) => {
    const isExpense = 'product' in row;
    const label = isExpense ? row.product : getRelationName(data.incomeSources, row.sourceId);
    if (!window.confirm(`¿Eliminar «${label}»?`)) return;
    void data.del(isExpense ? 'expenses' : 'incomes', row.id);
    setDetail(null);
  };

  const expenseColumns: Column<Expense>[] = [
    { key: 'date', header: 'Fecha', width: '92px', render: (e) => <span className="muted">{shortDate(e.date)}</span> },
    { key: 'product', header: 'Producto', primary: true, render: (e) => (
      <span className="truncate">{e.product}{e.quantity !== 1 && <span className="tiny muted num"> × {e.quantity}</span>}</span>
    ) },
    { key: 'category', header: 'Rubro', width: '150px', render: (e) => (
      <span className="tag cat truncate" style={{ '--tag-color': getRelationColor(data.categories, e.categoryId) } as CSSProperties}>{getRelationName(data.categories, e.categoryId)}</span>
    ) },
    { key: 'place', header: 'Lugar', width: '150px', hideOnMobile: true, render: (e) => <span className="truncate muted">{getRelationName(data.places, e.placeId, '—')}</span> },
    { key: 'bs', header: 'Bs', align: 'end', width: '130px', hideOnMobile: true, render: (e) => <span className="text-bs">{formatBs(e.totalBs)}</span> },
    { key: 'usd', header: 'USD', align: 'end', width: '100px', render: (e) => <span className="text-usd strong">{formatUsd(e.totalUsd)}</span> },
  ];

  const incomeColumns: Column<Income>[] = [
    { key: 'date', header: 'Fecha', width: '92px', render: (i) => <span className="muted">{shortDate(i.date)}</span> },
    { key: 'source', header: 'Origen', primary: true, render: (i) => <span className="truncate">{getRelationName(data.incomeSources, i.sourceId, 'Sin origen')}</span> },
    { key: 'owner', header: 'Dinero', width: '110px', render: (i) => <span className={`tag ${i.owner === 'propio' ? 'ok' : ''}`}>{i.owner}</span> },
    { key: 'note', header: 'Nota', hideOnMobile: true, render: (i) => <span className="truncate muted">{i.note ?? '—'}</span> },
    { key: 'bs', header: 'Bs', align: 'end', width: '130px', hideOnMobile: true, render: (i) => <span className="text-bs">{formatBs(i.amountBs)}</span> },
    { key: 'usd', header: 'USD', align: 'end', width: '100px', render: (i) => <span className="text-usd strong">{formatUsd(i.amountUsd)}</span> },
  ];

  const rowActions = (row: Expense | Income) => (
    <>
      <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditing(row)}><Pencil size={15} /></button>
      <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => removeRecord(row)}><Trash2 size={15} /></button>
    </>
  );

  const detailIsExpense = detail !== null && 'product' in detail;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Movimientos</h1><p className="page-subtitle">Cada registro guarda la tasa del día. El dólar es la vara, el bolívar el medio.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="row-between wrap">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'gastos'} className={`tab${tab === 'gastos' ? ' active' : ''}`} onClick={() => setTab('gastos')}>Gastos <span className="num muted">{monthExpenses.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'ingresos'} className={`tab${tab === 'ingresos' ? ' active' : ''}`} onClick={() => setTab('ingresos')}>Ingresos <span className="num muted">{monthIncomes.length}</span></button>
        </div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> {tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'}</button>}
      </div>

      <div className="grid grid-4">
        <StatCard tone={tab === 'gastos' ? 'bs' : 'usd'} icon={tab === 'gastos' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
          label={activeCount > 0 ? 'Total filtrado' : 'Total del mes'}
          value={<Money amount={totalUsd} currency="USD" rate={data.currentRate} dual size="lg" align="start" />}
          hint={`${formatBs(totalBs)} · ${count} registros`} />
        <StatCard tone="primary" icon={<Receipt size={18} />} label="Promedio por registro"
          value={<span className="num">{formatUsd(count > 0 ? totalUsd / count : 0)}</span>}
          hint={activeCount > 0 ? `${formatPct(allUsd > 0 ? totalUsd / allUsd : 0)} del mes` : 'Sin filtros activos'} />
        <StatCard tone="warn" icon={<Receipt size={18} />} label={tab === 'gastos' ? 'Rubro más pesado' : 'Origen más grande'}
          value={<span className="truncate">{topGroup?.name ?? '—'}</span>}
          hint={topGroup ? formatUsd(topGroup.usd) : 'Sin datos'} />
        <StatCard tone="ok" icon={<Receipt size={18} />} label="Tasa promedio del filtro"
          value={<span className="num">{formatBs(totalUsd > 0 ? totalBs / totalUsd : 0)}</span>}
          hint="Bs por dólar" />
      </div>

      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <label className="field filterbar-wide"><span className="field-label">Buscar</span>
          <input className="input" placeholder={tab === 'gastos' ? 'Producto, lugar o rubro…' : 'Origen o nota…'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {tab === 'gastos' ? (
          <>
            <label className="field"><span className="field-label">Rubro</span>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todos</option>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Lugar</span>
              <select className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">Todos</option>
                {data.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field"><span className="field-label">Origen</span>
              <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Todos</option>
                {data.incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Dinero</span>
              <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as '' | MoneyOwner)}>
                <option value="">Todo</option>
                <option value="propio">Propio</option>
                <option value="tercero">De terceros</option>
              </select>
            </label>
          </>
        )}
        <label className="field"><span className="field-label">Monto mínimo ($)</span>
          <input className="input num" type="number" min="0" step="0.5" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} placeholder="0" />
        </label>
      </FilterBar>

      <div className="card card-tight">
        {tab === 'gastos' ? (
          <DataTable rows={expenses} columns={expenseColumns} onRowClick={setDetail} actions={editable ? rowActions : undefined}
            empty={<EmptyState title="Sin gastos" hint={activeCount > 0 ? 'Ningún gasto coincide con los filtros.' : 'Registra lo que compras para saber en qué se va el dinero.'} />} />
        ) : (
          <DataTable rows={incomes} columns={incomeColumns} onRowClick={setDetail} actions={editable ? rowActions : undefined}
            empty={<EmptyState title="Sin ingresos" hint={activeCount > 0 ? 'Ningún ingreso coincide con los filtros.' : 'Registra lo que entra y marca el dinero de terceros.'} />} />
        )}
      </div>

      {/* Detalle */}
      {detail && detailIsExpense && (
        <DetailSheet
          open title={(detail as Expense).product} subtitle={`${shortDate(detail.date)} · ${getRelationName(data.places, (detail as Expense).placeId, 'sin lugar')}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => removeRecord(detail) : undefined}
          fields={[
            { label: 'Rubro', value: getRelationName(data.categories, (detail as Expense).categoryId) },
            { label: 'Cantidad', value: <span className="num">{(detail as Expense).quantity}</span> },
            { label: 'Precio unitario', value: <span className="num">{formatBs((detail as Expense).unitPriceBs)}</span> },
            { label: 'Tasa del día', value: <span className="num">{formatBs(detail.rate)}</span> },
            { label: 'Total Bs', value: <span className="num text-bs">{formatBs((detail as Expense).totalBs)}</span> },
            { label: 'Total USD', value: <span className="num text-usd">{formatUsd((detail as Expense).totalUsd)}</span> },
            { label: 'Precio hoy', value: <span className="num">{formatBs((detail as Expense).totalUsd * data.currentRate)}</span>, wide: true },
          ]}
        />
      )}
      {detail && !detailIsExpense && (
        <DetailSheet
          open title={getRelationName(data.incomeSources, (detail as Income).sourceId, 'Ingreso')} subtitle={shortDate(detail.date)}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => removeRecord(detail) : undefined}
          fields={[
            { label: 'Dinero', value: (detail as Income).owner },
            { label: 'Tasa del día', value: <span className="num">{formatBs(detail.rate)}</span> },
            { label: 'Monto Bs', value: <span className="num text-bs">{formatBs((detail as Income).amountBs)}</span> },
            { label: 'Monto USD', value: <span className="num text-usd">{formatUsd((detail as Income).amountUsd)}</span> },
            { label: 'Nota', value: (detail as Income).note ?? '—', wide: true },
          ]}
        />
      )}

      {/* Alta y edición */}
      <Modal title={tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'} open={creating} onClose={() => setCreating(false)}>
        {tab === 'gastos' ? <ExpenseForm onDone={() => setCreating(false)} /> : <IncomeForm onDone={() => setCreating(false)} />}
      </Modal>
      <Modal title="Editar movimiento" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && ('product' in editing
          ? <ExpenseForm expense={editing} onDone={() => setEditing(null)} />
          : <IncomeForm income={editing} onDone={() => setEditing(null)} />)}
      </Modal>
    </div>
  );
}
