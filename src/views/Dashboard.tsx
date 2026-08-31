import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, CheckCircle2, CreditCard,
  Info, Landmark, Lightbulb, Package, PiggyBank, TrendingUp, Wallet,
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useMonth } from '../hooks/useMonth';
import type { UserSettings } from '../types';
import MonthPicker from '../components/ui/MonthPicker';
import Donut from '../components/ui/Donut';
import Sparkline from '../components/ui/Sparkline';
import ProgressBar from '../components/ui/ProgressBar';
import {
  availableBalanceBs, buildAdvice, cashNeeded, debtCapacity, emergencyFundTarget,
  expensesByCategory, groupTargets, incomeByKind, inflationSummary, ownIncomeUsd,
} from '../utils/finance';
import { formatBs, formatPct, formatUsd, sum, toUsd } from '../utils/money';
import { addDays, daysBetween, monthOf, shortDate, todayIso } from '../utils/dates';
import { daysToPayday } from '../utils/cycle';
import './Dashboard.css';

const ADVICE_ICON = { urgente: <AlertTriangle size={15} />, atencion: <Info size={15} />, ok: <CheckCircle2 size={15} /> };

export default function Dashboard() {
  const data = useData();
  const { categories, creditors, currentRate, rates, incomes, expenses, inventory, shopping, debts, fixedCosts, goals, set, settingsFor } = data;
  const { canEdit } = usePermissions();
  const { month, prev, next, monthIncomes, monthExpenses, monthFixed, monthDebts } = useMonth();
  const settings = settingsFor(month);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState(String(settings.balanceBs ?? ''));

  const today = todayIso();
  const horizon = addDays(today, 7);
  const incomeUsd = ownIncomeUsd(monthIncomes);
  const expenseUsd = sum(monthExpenses.map((e) => e.totalUsd));
  const balance = incomeUsd - expenseUsd;
  const kinds = incomeByKind(monthIncomes);
  const capacity = debtCapacity(incomeUsd, monthDebts, monthFixed, settings);
  const byCat = expensesByCategory(monthExpenses, categories);
  const groups = groupTargets(incomeUsd, monthExpenses, monthDebts.filter((d) => d.status === 'pagada'), categories, settings);

  const urgentBuysUsd = sum(shopping.filter((s) => !s.checked && s.priority === 'urgente').map((s) => s.estimatedUsd * s.quantity));
  const cash = cashNeeded(debts, fixedCosts.filter((f) => f.month === month), urgentBuysUsd, today, horizon);

  const calcBalanceBs = availableBalanceBs(incomes, expenses);
  const calcBalanceUsd = toUsd(calcBalanceBs, currentRate);
  const declaredBs = settings.balanceBs;
  const gapBs = declaredBs !== undefined ? declaredBs - calcBalanceBs : null;
  const coverage = calcBalanceUsd - cash.totalUsd;

  const emergency = emergencyFundTarget(monthFixed, settings.emergencyFundMonths);
  const savedUsd = sum(goals.map((g) => g.savedUsd));
  const advice = buildAdvice(
    {
      incomeUsd, expensesUsd: expenseUsd, fixedUsd: capacity.fixedCostsUsd, debtUsd: capacity.monthlyDebtUsd,
      savedUsd, emergencyTargetUsd: emergency, wantsUsd: groups.find((g) => g.group === 'deseo')?.actualUsd ?? 0, settings,
    },
    cash.overdueUsd,
    byCat[0] ? { name: byCat[0].name, usd: byCat[0].usd } : undefined,
  ).slice(0, 3);

  const cumulative = useMemo(() => {
    const byDay = new Map<string, number>();
    monthExpenses.forEach((e) => byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.totalUsd));
    let acc = 0;
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => (acc += v));
  }, [monthExpenses]);

  const monthRates = rates.filter((r) => monthOf(r.date) === month);
  const inflation = inflationSummary(monthRates);
  const dueSoon = debts.filter((d) => d.status !== 'pagada' && daysBetween(today, d.dueDate) <= 7).slice(0, 4);
  const lowStock = inventory.filter((i) => i.quantity <= i.minQuantity);
  const pendingFixed = monthFixed.filter((f) => f.status !== 'pagada');
  const toPayday = daysToPayday(today);

  const saveBalance = async () => {
    const value = Number(balanceDraft);
    if (!Number.isFinite(value) || value < 0) return;
    await set<UserSettings>('settings', month, { ...settings, month, balanceBs: value, balanceUpdatedAt: today });
    setEditingBalance(false);
  };

  return (
    <div className="page dash">
      <div className="page-header">
        <div><h1>Resumen</h1><p className="page-subtitle">Todo en dólares BCV para que la inflación no distorsione la foto.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      {/* Panel principal: cuánto hay, cuánto debes, cuánto queda */}
      <section className={`hero${coverage < 0 ? ' hero-alert' : ''}`}>
        <div className="hero-main">
          <span className="hero-label"><Landmark size={14} /> Disponible en la cuenta</span>
          <span className="hero-value num">{formatBs(calcBalanceBs)}</span>
          <span className="hero-sub num">{formatUsd(calcBalanceUsd)} · tasa {formatBs(currentRate)}</span>
          <div className="hero-meter">
            <ProgressBar ratio={calcBalanceUsd > 0 ? Math.min(1, cash.totalUsd / calcBalanceUsd) : 1}
              color={coverage < 0 ? 'var(--color-danger)' : 'rgba(255,255,255,0.9)'} />
            <span className="hero-meter-text">
              {coverage >= 0
                ? `Cubres tus ${formatUsd(cash.totalUsd)} de compromisos y te quedan ${formatUsd(coverage)}`
                : `Te faltan ${formatUsd(-coverage)} para cubrir ${formatUsd(cash.totalUsd)} de compromisos`}
            </span>
          </div>
        </div>
        <dl className="hero-stats">
          <div><dt>Vencido</dt><dd className={cash.overdueUsd > 0 ? 'hero-bad' : ''}>{formatUsd(cash.overdueUsd)}</dd></div>
          <div><dt>Vence en 7 días</dt><dd>{formatUsd(cash.dueSoonUsd)}</dd></div>
          <div><dt>Próximo cobro</dt><dd>{toPayday === 0 ? 'Hoy' : `${toPayday} d`}</dd></div>
          <div>
            <dt>Saldo declarado</dt>
            <dd>
              {editingBalance ? (
                <span className="hero-balance-edit">
                  <input className="input num" type="number" step="0.01" min="0" value={balanceDraft} autoFocus
                    onChange={(e) => setBalanceDraft(e.target.value)} aria-label="Saldo en bolívares" />
                  <button type="button" className="btn btn-sm hero-ok" onClick={saveBalance}>OK</button>
                </span>
              ) : (
                <button type="button" className="hero-balance-btn" onClick={() => setEditingBalance(true)} disabled={!canEdit('ajustes')}>
                  {declaredBs !== undefined ? formatBs(declaredBs) : 'Registrar'}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {gapBs !== null && Math.abs(gapBs) > 1 && (
        <p className="dash-gap small"><AlertTriangle size={14} /> Tu saldo declarado difiere en {formatBs(Math.abs(gapBs))} del calculado: falta registrar algún movimiento.</p>
      )}

      {/* KPIs */}
      <div className="kpis">
        <article className="kpi kpi-in">
          <span className="kpi-icon"><ArrowUpCircle size={16} /></span>
          <span className="kpi-label">Ingresos</span>
          <span className="kpi-value num">{formatUsd(incomeUsd)}</span>
          <span className="kpi-hint">{formatUsd(kinds.fixedUsd)} fijos · {formatUsd(kinds.variableUsd)} variables</span>
          <ProgressBar ratio={kinds.stability} color="var(--color-usd)" />
        </article>
        <article className="kpi kpi-out">
          <span className="kpi-icon"><ArrowDownCircle size={16} /></span>
          <span className="kpi-label">Gastos</span>
          <span className="kpi-value num">{formatUsd(expenseUsd)}</span>
          <span className="kpi-hint">{incomeUsd > 0 ? `${formatPct(expenseUsd / incomeUsd)} del ingreso` : 'Sin ingresos cargados'}</span>
          <ProgressBar ratio={incomeUsd > 0 ? expenseUsd / incomeUsd : 0} color={expenseUsd > incomeUsd ? 'var(--color-danger)' : 'var(--color-bs)'} />
        </article>
        <article className={`kpi ${balance >= 0 ? 'kpi-ok' : 'kpi-bad'}`}>
          <span className="kpi-icon"><PiggyBank size={16} /></span>
          <span className="kpi-label">Ahorro del mes</span>
          <span className="kpi-value num">{formatUsd(balance)}</span>
          <span className="kpi-hint">{incomeUsd > 0 ? `${formatPct(balance / incomeUsd)} · meta ${settings.savingsTargetPct}%` : '—'}</span>
          <ProgressBar ratio={incomeUsd > 0 ? Math.max(0, balance / incomeUsd) / (settings.savingsTargetPct / 100) : 0} color="var(--color-ok)" />
        </article>
        <article className={`kpi ${capacity.level === 'sano' ? 'kpi-ok' : capacity.level === 'alerta' ? 'kpi-warn' : 'kpi-bad'}`}>
          <span className="kpi-icon"><CreditCard size={16} /></span>
          <span className="kpi-label">Deuda / ingreso</span>
          <span className="kpi-value num">{formatPct(capacity.ratio)}</span>
          <span className="kpi-hint">Margen: {formatUsd(capacity.availableUsd)}</span>
          <ProgressBar ratio={capacity.ratio / (settings.maxDebtRatioPct / 100)}
            color={capacity.level === 'sano' ? 'var(--color-ok)' : capacity.level === 'alerta' ? 'var(--color-warn)' : 'var(--color-danger)'} />
        </article>
      </div>

      {/* Consejos */}
      {advice.length > 0 && (
        <section className="card dash-advice-card">
          <div className="card-header"><h2 className="card-title"><Lightbulb size={16} /> Qué conviene hacer</h2><Link to="/reportes" className="small">Ver reportes</Link></div>
          <ul className="dash-advice">
            {advice.map((a) => (
              <li key={a.id} className={`dash-advice-item ${a.level}`}>
                <span className="dash-advice-icon">{ADVICE_ICON[a.level]}</span>
                <div><p className="strong small">{a.title}</p><p className="tiny">{a.detail}</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <span>El bolívar perdió <strong>{formatPct(inflation.devaluationPct)}</strong> este mes. 1.000 Bs guardados el {shortDate(monthRates[monthRates.length - 1].date)} hoy valen {formatUsd(1000 / inflation.lastRate)}.</span>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-3">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Vencen pronto</h2><Link to="/recordatorios" className="small">Ver todo</Link></div>
          {dueSoon.length === 0 ? <p className="muted small">Nada vence en los próximos 7 días.</p> : (
            <ul className="dash-list">
              {dueSoon.map((d) => {
                const days = daysBetween(today, d.dueDate);
                return (
                  <li key={d.id} className="dash-list-item">
                    <span className="dash-list-icon"><CalendarClock size={14} /></span>
                    <span className="dash-list-text">
                      <span className="strong truncate">{d.merchant}</span>
                      <span className="tiny muted truncate">{creditors.find((c) => c.id === d.creditorId)?.name ?? 'Cuota'} · {shortDate(d.dueDate)}</span>
                    </span>
                    <span className={`tag ${days < 0 ? 'danger' : days <= 2 ? 'warn' : ''}`}>{days < 0 ? 'Vencida' : days === 0 ? 'Hoy' : `${days} d`}</span>
                    <span className="num strong">{formatUsd(d.amountUsd)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Costos fijos</h2><Link to="/costos-fijos" className="small">Ver todos</Link></div>
          {monthFixed.length === 0 ? <p className="muted small">No hay costos fijos cargados este mes.</p> : (
            <>
              <ProgressBar ratio={monthFixed.length ? (monthFixed.length - pendingFixed.length) / monthFixed.length : 0} color="var(--color-ok)" />
              <p className="small muted dash-fixed-hint">{formatUsd(sum(pendingFixed.map((f) => f.amountUsd)))} pendientes de {formatUsd(sum(monthFixed.map((f) => f.amountUsd)))}</p>
              <ul className="dash-list">
                {pendingFixed.slice(0, 4).map((f) => (
                  <li key={f.id} className="dash-list-item">
                    <span className="dash-list-icon"><Wallet size={14} /></span>
                    <span className="dash-list-text"><span className="strong truncate">{f.description}</span><span className="tiny muted">día {f.dueDay}</span></span>
                    <span className="num strong">{formatUsd(f.amountUsd)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Casa y metas</h2><Link to="/metas" className="small">Metas</Link></div>
          <dl className="kv">
            <div><dt><Package size={13} /> Por reponer</dt><dd className={lowStock.length ? 'text-warn' : ''}>{lowStock.length}</dd></div>
            <div><dt>Compras urgentes</dt><dd className={urgentBuysUsd > 0 ? 'text-danger' : ''}>{formatUsd(urgentBuysUsd)}</dd></div>
            <div><dt><TrendingUp size={13} /> Ahorrado en metas</dt><dd className="text-ok">{formatUsd(savedUsd)}</dd></div>
            <div><dt>Fondo de emergencia</dt><dd>{formatUsd(emergency)}</dd></div>
          </dl>
          {emergency > 0 && <ProgressBar ratio={savedUsd / emergency} color="var(--color-ok)" />}
        </section>
      </div>
    </div>
  );
}
