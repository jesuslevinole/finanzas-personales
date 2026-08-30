import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import type { UserSettings } from '../types';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import StatCard from '../components/ui/StatCard';
import Donut from '../components/ui/Donut';
import Sparkline from '../components/ui/Sparkline';
import Money from '../components/ui/Money';
import ProgressBar from '../components/ui/ProgressBar';
import { availableBalanceBs, cashNeeded, debtCapacity, expensesByCategory, inflationSummary, ownIncomeUsd } from '../utils/finance';
import { formatBs, formatPct, formatUsd, sum, toUsd } from '../utils/money';
import { getRelationName } from '../utils/relations';
import { addDays, daysBetween, monthOf, shortDate, todayIso } from '../utils/dates';
import './Dashboard.css';

export default function Dashboard() {
  const { categories, creditors, currentRate, rates, incomes, expenses, inventory, shopping, settings, debts, fixedCosts, set } = useData();
  const { canEdit } = usePermissions();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState(String(settings.balanceBs ?? ''));
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
  const horizon = addDays(today, 7);
  const urgentBuysUsd = sum(shopping.filter((s) => !s.checked && s.priority === 'urgente').map((s) => s.estimatedUsd * s.quantity));
  const cash = cashNeeded(debts, fixedCosts.filter((f) => f.month === month), urgentBuysUsd, today, horizon);
  const dueSoon = debts.filter((d) => d.status !== 'pagada' && daysBetween(today, d.dueDate) <= 7).slice(0, 5);
  const lowStock = inventory.filter((i) => i.quantity <= i.minQuantity);
  const urgent = shopping.filter((s) => !s.checked && s.priority === 'urgente');
  const balance = incomeUsd - expenseUsd;
  // Lo que la app calcula que debe haber en la cuenta: todo lo que entró menos lo que salió.
  const calcBalanceBs = availableBalanceBs(incomes, expenses);
  const calcBalanceUsd = toUsd(calcBalanceBs, currentRate);
  const declaredBs = settings.balanceBs;
  const declaredUsd = toUsd(declaredBs ?? 0, currentRate);
  const gapBs = declaredBs !== undefined ? declaredBs - calcBalanceBs : null;
  const coverage = (declaredBs !== undefined ? declaredUsd : calcBalanceUsd) - cash.totalUsd;

  const saveBalance = async () => {
    const value = Number(balanceDraft);
    if (!Number.isFinite(value) || value < 0) return;
    await set<UserSettings>('settings', 'main', { ...settings, balanceBs: value, balanceUpdatedAt: today });
    setEditingBalance(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Resumen</h1>
          <p className="page-subtitle">Todo en dólares BCV para que la inflación no distorsione la foto.</p>
        </div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <section className={`card dash-cash ${coverage < 0 ? 'alert' : ''}`}>
        <div className="dash-cash-main">
          <span className="stat-icon dash-cash-icon"><Landmark size={18} /></span>
          <div className="grow">
            <span className="field-label">Disponible en la cuenta</span>
            <div className="dash-cash-value"><Money amount={calcBalanceBs} currency="VES" rate={currentRate} dual size="lg" align="start" /></div>
            <p className="tiny muted">Todo lo que entró menos todo lo que salió ({incomes.length} ingresos, {expenses.length} gastos).</p>
            {gapBs !== null && Math.abs(gapBs) > 0.5 && (
              <p className={`tiny ${Math.abs(gapBs) > 1 ? 'text-danger' : 'muted'}`}>
                Tu saldo declarado difiere en {formatBs(Math.abs(gapBs))}: falta registrar algún movimiento.
              </p>
            )}
          </div>
        </div>
        <dl className="kv dash-cash-kv">
          <div><dt>Compromisos próximos</dt><dd className={cash.totalUsd > 0 ? 'text-danger' : ''}>{formatUsd(cash.totalUsd)}</dd></div>
          <div><dt>Vencido</dt><dd>{formatUsd(cash.overdueUsd)}</dd></div>
          <div><dt>Vence en 7 días + fijos</dt><dd>{formatUsd(cash.dueSoonUsd)}</dd></div>
          <div>
            <dt>Saldo declarado</dt>
            <dd>
              {editingBalance ? (
                <span className="dash-balance-edit">
                  <input className="input num" type="number" step="0.01" min="0" value={balanceDraft} autoFocus
                    onChange={(e) => setBalanceDraft(e.target.value)} aria-label="Saldo en bolívares" />
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveBalance}>OK</button>
                </span>
              ) : (
                <button type="button" className="dash-balance-btn" onClick={() => setEditingBalance(true)} disabled={!canEdit('ajustes')}>
                  {declaredBs !== undefined ? formatBs(declaredBs) : 'Registrar'}
                </button>
              )}
            </dd>
          </div>
          <div className="dash-cash-total">
            <dt>{coverage >= 0 ? 'Te queda libre' : 'Te falta'}</dt>
            <dd className={coverage < 0 ? 'text-danger' : 'text-ok'}>{formatUsd(Math.abs(coverage))}</dd>
          </div>
        </dl>
      </section>

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
