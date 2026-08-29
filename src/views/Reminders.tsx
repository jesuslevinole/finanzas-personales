import { AlertTriangle, CalendarClock, Check, ChevronLeft, ChevronRight, CreditCard, Package, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { usePayCycle, type CycleDue } from '../hooks/usePayCycle';
import { usePermissions } from '../hooks/usePermissions';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import DataTable, { type Column } from '../components/ui/DataTable';
import Money from '../components/ui/Money';
import type { Debt, FixedCost, ShoppingItem } from '../types';
import { daysToPayday } from '../utils/cycle';
import { formatUsd, sum } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Reminders.css';

const KIND_ICON = {
  deuda: <CreditCard size={15} />,
  costo_fijo: <CalendarClock size={15} />,
  compra: <ShoppingCart size={15} />,
};

export default function Reminders() {
  const { currentRate, update } = useData();
  const { canEdit } = usePermissions();
  const { cycle, goPrev, goNext, goCurrent, overdue, dueThisCycle, upcoming, lowStock } = usePayCycle();
  const today = todayIso();
  const toPayday = daysToPayday(today);

  const cycleTotal = sum(dueThisCycle.map((i) => i.amountUsd));
  const overdueTotal = sum(overdue.map((i) => i.amountUsd));
  const upcomingTotal = sum(upcoming.map((i) => i.amountUsd));

  const markDone = (item: CycleDue) => {
    if (item.kind === 'deuda') void update<Debt>('debts', (item.source as Debt).id, { status: 'pagada' });
    else if (item.kind === 'costo_fijo') void update<FixedCost>('fixedCosts', (item.source as FixedCost).id, { status: 'pagada', paidDate: today });
    else void update<ShoppingItem>('shopping', (item.source as ShoppingItem).id, { checked: true });
  };

  const columns: Column<CycleDue>[] = [
    { key: 'kind', header: 'Tipo', width: '44px', render: (i) => <span className={`rem-kind ${i.kind}`}>{KIND_ICON[i.kind]}</span> },
    { key: 'title', header: 'Concepto', primary: true, render: (i) => <span className="truncate">{i.title}</span> },
    { key: 'subtitle', header: 'Detalle', width: '150px', hideOnMobile: true, render: (i) => <span className="muted truncate">{i.subtitle}</span> },
    { key: 'date', header: 'Vence', width: '120px', render: (i) => (
      <span className={i.overdue ? 'text-danger strong' : ''}>{i.kind === 'compra' ? 'Cuando compres' : shortDate(i.date)}</span>
    ) },
    { key: 'amount', header: 'Monto', align: 'end', width: '110px', render: (i) => <span className="strong num">{formatUsd(i.amountUsd)}</span> },
  ];

  const actions = canEdit('deudas')
    ? (i: CycleDue) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Marcar como resuelto" onClick={() => markDone(i)}><Check size={16} /></button>
    : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Recordatorios</h1>
          <p className="page-subtitle">Todo se agrupa por semana de cobro: del sábado al viernes siguiente.</p>
        </div>
        <div className="rem-cycle">
          <button type="button" className="btn btn-ghost btn-icon" onClick={goPrev} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
          <button type="button" className="rem-cycle-label" onClick={goCurrent}>{cycle.label}</button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={goNext} aria-label="Semana siguiente"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard tone={overdue.length ? 'danger' : 'ok'} icon={<AlertTriangle size={18} />} label="Vencido"
          value={<Money amount={overdueTotal} currency="USD" rate={currentRate} dual size="lg" align="start" />}
          hint={`${overdue.length} pendientes de antes`} />
        <StatCard tone="primary" icon={<CalendarClock size={18} />} label="Esta semana de cobro"
          value={<Money amount={cycleTotal} currency="USD" rate={currentRate} dual size="lg" align="start" />}
          hint={`${dueThisCycle.length} conceptos`} />
        <StatCard tone="warn" icon={<CreditCard size={18} />} label="Semanas siguientes"
          value={<span className="num">{formatUsd(upcomingTotal)}</span>}
          hint={`${upcoming.length} conceptos por venir`} />
        <StatCard tone="usd" icon={<Package size={18} />} label="Próximo cobro"
          value={<span>{toPayday === 0 ? 'Hoy' : `En ${toPayday} d`}</span>}
          hint={`Necesitas ${formatUsd(overdueTotal + cycleTotal)} para cubrir lo abierto`} />
      </div>

      {overdue.length > 0 && (
        <section className="card card-tight rem-overdue">
          <div className="card-header"><h2 className="card-title">Vencido — atiéndelo primero</h2><span className="tag danger">{overdue.length}</span></div>
          <DataTable rows={overdue} columns={columns} actions={actions} rowClass={() => 'danger-row'} />
        </section>
      )}

      <section className="card card-tight">
        <div className="card-header">
          <h2 className="card-title">Del {cycle.label}</h2>
          <span className="tag primary">{formatUsd(cycleTotal)}</span>
        </div>
        <DataTable rows={dueThisCycle} columns={columns} actions={actions}
          empty={<EmptyState title="Nada pendiente esta semana" hint="Ni cuotas, ni costos fijos, ni compras urgentes en esta ventana." />} />
      </section>

      <div className="grid grid-2">
        <section className="card card-tight">
          <div className="card-header"><h2 className="card-title">Se viene después</h2><Link to="/deudas" className="small">Ver deudas</Link></div>
          <DataTable rows={upcoming.slice(0, 8)} columns={columns.filter((c) => c.key !== 'subtitle')}
            empty={<EmptyState title="Sin vencimientos futuros" />} />
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Por reponer en casa</h2><Link to="/inventario" className="small">Inventario</Link></div>
          {lowStock.length === 0 ? <EmptyState title="Despensa completa" hint="Ningún producto está por debajo de su mínimo." /> : (
            <ul className="rem-stock">
              {lowStock.slice(0, 10).map((i) => (
                <li key={i.id} className="rem-stock-item">
                  <span className="truncate">{i.name}</span>
                  <span className="tiny muted num">{i.quantity} / {i.minQuantity} {i.unit}</span>
                  <span className="num">{formatUsd(i.lastPriceUsd)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
