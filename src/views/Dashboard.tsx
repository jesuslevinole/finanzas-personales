import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, CreditCard, ShieldCheck } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import StatCard from '../components/ui/StatCard';
import Donut from '../components/ui/Donut';
import Sparkline from '../components/ui/Sparkline';
import Money from '../components/ui/Money';
import ProgressBar from '../components/ui/ProgressBar';
import { debtCapacity, expensesByCategory, inflationSummary, ownIncomeUsd } from '../utils/finance';
import { formatPct, formatUsd, sum } from '../utils/money';
import { getRelationName } from '../utils/relations';
import { daysBetween, monthOf, shortDate, todayIso } from '../utils/dates';
import './Dashboard.css';

export default function Dashboard() {
  const { categories, creditors, currentRate, rates, inventory, shopping, settings, debts } = useData();
  const { month, prev, next, monthIncomes, monthExpenses, monthFixed, monthDebts } = useMonth();

  const incomeUsd = ownIncomeUsd(monthIncomes);
  const expenseUsd = sum(monthExpenses.map((e) => e.totalUsd));
  const pendingFixed = monthFixed.filter((f) => f.status !== 'pagada');
  const capacity = debtCapacity(incomeUsd, monthDebts, monthFixed, settings);
  const byCat = expensesByCategory(monthExpenses, categories);
  const monthRates = rates.filter((r) => monthOf(r.date) === month);
  const inflation = inflationSummary(monthRates);

  const cumulative = useMemo(() => {
    const byDay = new Map<string, number>();
    monthExpenses.forEach((e) => byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.totalUsd));
    let acc = 0;
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => (acc += v));
  }, [monthExpenses]);

  const today = todayIso();
  const dueSoon = debts.filter((d) => d.status !== 'pagada' && daysBetween(today, d.dueDate) <= 7).slice(0, 5);
  const lowStock = inventory.filter((i) => i.quantity <= i.minQuantity);
  const urgent = shopping.filter((s) => !s.checked && s.priority === 'urgente');
  const balance = incomeUsd - expenseUsd;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Resumen</h1>
          <p className="page-subtitle">Todo en dólares BCV para que la inflación no distorsione la foto.</p>
        </div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="grid grid-4">
        <StatCard tone="usd" icon={<ArrowUpCircle size={18} />} label="Ingresos propios" value={<Money amount={incomeUsd} currency="USD" rate={currentRate} dual size="md" />} />
        <StatCard tone="bs" icon={<ArrowDownCircle size={18} />} label="Gastos" value={<Money amount={expenseUsd} currency="USD" rate={currentRate} dual size="md" />} hint={incomeUsd > 0 ? `${formatPct(expenseUsd / incomeUsd)} del ingreso` : undefined} />
        <StatCard tone={balance >= 0 ? 'ok' : 'danger'} icon={<ShieldCheck size={18} />} label="Balance del mes" value={<span className={`num ${balance >= 0 ? 'text-ok' : 'text-danger'}`}>{formatUsd(balance)}</span>} hint={`${pendingFixed.length} costos fijos pendientes`} />
        <StatCard tone={capacity.level === 'sano' ? 'primary' : capacity.level === 'alerta' ? 'warn' : 'danger'} icon={<CreditCard size={18} />} label="Deuda / ingreso" value={<span className="num">{formatPct(capacity.ratio)}</span>} hint={`Podés comprometer ${formatUsd(capacity.availableUsd)} más`} />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Gastos por rubro</h2><Link to="/presupuesto" className="small">Presupuesto</Link></div>
          {byCat.length === 0 ? <p className="muted small">Sin gastos registrados este mes.</p> : (
            <div className="dash-donut">
              <Donut slices={byCat.map((c) => ({ color: c.color, share: c.share }))} centerLabel={formatUsd(expenseUsd)} centerSub="Total" />
              <ul className="dash-legend">
                {byCat.slice(0, 6).map((c) => (
                  <li key={c.categoryId} className="dash-legend-item">
                    <span className="dot" style={{ '--dot-color': c.color } as CSSProperties} />
                    <span className="dash-legend-name truncate">{c.name}</span>
                    <span className="num strong dash-legend-value">{formatUsd(c.usd)}</span>
                    <span className="num muted tiny dash-legend-share">{formatPct(c.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Gasto acumulado</h2><span className="tag usd">USD</span></div>
          <Sparkline values={cumulative} height={120} tone="usd" />
          {inflation && (
            <div className="dash-inflation">
              <AlertTriangle size={14} />
              <span>El bolívar perdió <strong>{formatPct(inflation.devaluationPct)}</strong> frente al dólar este mes. 1.000 Bs guardados el {shortDate(monthRates[monthRates.length - 1].date)} hoy valen {formatUsd(1000 / inflation.lastRate)} ({formatUsd(inflation.lossPer1000Bs)} menos).</span>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-3">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Vencen pronto</h2><Link to="/recordatorios" className="small">Recordatorios</Link></div>
          {dueSoon.length === 0 ? <p className="muted small">Nada vence en los próximos 7 días.</p> : (
            <ul>
              {dueSoon.map((d) => {
                const days = daysBetween(today, d.dueDate);
                return (
                  <li key={d.id} className="record">
                    <span className="record-main">
                      <CalendarClock size={14} className={days < 0 ? 'text-danger' : 'muted'} />
                      <span className="record-title">{d.merchant}</span>
                    </span>
                    <span className="record-meta">
                      <span className="truncate">{getRelationName(creditors, d.creditorId)} · {shortDate(d.dueDate)}</span>
                      <span className={`tag ${days < 0 ? 'danger' : days <= 2 ? 'warn' : ''}`}>{days < 0 ? 'Vencida' : days === 0 ? 'Hoy' : `${days} d`}</span>
                    </span>
                    <span className="record-amount num strong">{formatUsd(d.amountUsd)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Costos fijos</h2><Link to="/costos-fijos" className="small">Ver todos</Link></div>
          {monthFixed.length === 0 ? <p className="muted small">No hay costos fijos cargados para este mes.</p> : (
            <>
              <ProgressBar ratio={monthFixed.length ? (monthFixed.length - pendingFixed.length) / monthFixed.length : 0} />
              <p className="small muted dash-fixed-hint">{formatUsd(sum(pendingFixed.map((f) => f.amountUsd)))} pendientes de {formatUsd(sum(monthFixed.map((f) => f.amountUsd)))}</p>
              <ul>
                {pendingFixed.slice(0, 4).map((f) => (
                  <li key={f.id} className="record"><span className="record-main"><span className="record-title">{f.description}</span></span><span className="record-amount num">{formatUsd(f.amountUsd)}</span></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Despensa y compras</h2><Link to="/compras" className="small">Lista</Link></div>
          <dl className="kv dash-kv">
            <div><dt>Productos por reponer</dt><dd className={lowStock.length ? 'text-warn' : ''}>{lowStock.length}</dd></div>
            <div><dt>Compras urgentes</dt><dd className={urgent.length ? 'text-danger' : ''}>{urgent.length}</dd></div>
            <div><dt>Costo estimado lista</dt><dd className="num">{formatUsd(sum(shopping.filter((s) => !s.checked).map((s) => s.estimatedUsd * s.quantity)))}</dd></div>
          </dl>
          {lowStock.length > 0 && <p className="tiny muted dash-fixed-hint">Por reponer: {lowStock.slice(0, 4).map((i) => i.name).join(', ')}</p>}
        </section>
      </div>
    </div>
  );
}
