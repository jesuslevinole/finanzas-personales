import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, PiggyBank, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import ProgressBar from '../components/ui/ProgressBar';
import BarChart, { type Bar } from '../components/ui/BarChart';
import StatCard from '../components/ui/StatCard';
import ExportButton from '../components/ui/ExportButton';
import { useExport } from '../hooks/useExport';
import {
  buildAdvice, categoryTargets, debtCapacity, emergencyFundTarget, expensesByCategory,
  groupTargets, GROUP_LABEL, healthScore, inflationSummary, ownIncomeUsd, productInflation,
} from '../utils/finance';
import { formatPct, formatUsd, sum } from '../utils/money';
import { addMonths, monthLabel, monthOf } from '../utils/dates';
import './Reports.css';

const LEVEL_LABEL = { sano: 'Sano', alerta: 'En alerta', critico: 'Crítico' } as const;
const ADVICE_ICON = { urgente: <AlertTriangle size={16} />, atencion: <Info size={16} />, ok: <CheckCircle2 size={16} /> };

export default function Reports() {
  const { categories, rates, incomes, expenses, budgets, goals, inventory, settingsFor } = useData();
  const { month, prev, next, monthIncomes, monthExpenses, monthFixed, monthDebts } = useMonth();
  const { exporting, run: runExport } = useExport();

  const settings = settingsFor(month);
  const incomeUsd = ownIncomeUsd(monthIncomes);
  const expenseUsd = sum(monthExpenses.map((e) => e.totalUsd));
  const capacity = debtCapacity(incomeUsd, monthDebts, monthFixed, settings);
  const groups = groupTargets(incomeUsd, monthExpenses, monthDebts.filter((d) => d.status === 'pagada'), categories, settings);
  const byCat = expensesByCategory(monthExpenses, categories);
  const targets = categoryTargets(incomeUsd, monthExpenses, budgets.filter((b) => b.month === month), categories);
  const emergency = emergencyFundTarget(monthFixed, settings.emergencyFundMonths);
  const savedUsd = sum(goals.map((g) => g.savedUsd));
  const wantsUsd = groups.find((g) => g.group === 'deseo')?.actualUsd ?? 0;
  const savings = incomeUsd - expenseUsd;
  const savingsRate = incomeUsd > 0 ? savings / incomeUsd : 0;

  const health = healthScore({
    incomeUsd, expensesUsd: expenseUsd, fixedUsd: capacity.fixedCostsUsd, debtUsd: capacity.monthlyDebtUsd,
    savedUsd, emergencyTargetUsd: emergency, wantsUsd, settings,
  });
  const advice = buildAdvice(
    { incomeUsd, expensesUsd: expenseUsd, fixedUsd: capacity.fixedCostsUsd, debtUsd: capacity.monthlyDebtUsd, savedUsd, emergencyTargetUsd: emergency, wantsUsd, settings },
    sum(monthDebts.filter((d) => d.status !== 'pagada' && d.dueDate < month + '-32').map(() => 0)),
    byCat[0] ? { name: byCat[0].name, usd: byCat[0].usd } : undefined,
  );

  /* Últimos 6 meses */
  const history = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
    return months.map((m) => ({
      month: m,
      income: ownIncomeUsd(incomes.filter((i) => monthOf(i.date) === m)),
      expense: sum(expenses.filter((e) => monthOf(e.date) === m).map((x) => x.totalUsd)),
    }));
  }, [month, incomes, expenses]);

  const historyBars: Bar[] = history.map((h) => ({
    label: monthLabel(h.month).slice(0, 3),
    value: h.expense,
    compare: h.income,
    color: h.expense > h.income ? 'var(--color-danger)' : 'var(--color-primary)',
  }));

  const categoryBars: Bar[] = targets.slice(0, 10).map((t) => ({
    label: t.name,
    value: t.actualUsd,
    compare: t.budgetUsd ?? (t.suggestedUsd > 0 ? t.suggestedUsd : undefined),
    color: t.color,
  }));

  const groupBars: Bar[] = groups.map((g) => ({ label: GROUP_LABEL[g.group], value: g.actualUsd, compare: g.targetUsd }));

  const inflation = inflationSummary(rates.filter((r) => monthOf(r.date) <= month && r.date >= `${addMonths(month, -2)}-01`));
  const products = productInflation(inventory).slice(0, 6);
  const perPerson = settings.householdSize > 0 ? expenseUsd / settings.householdSize : expenseUsd;
  const fixedRatio = incomeUsd > 0 ? capacity.fixedCostsUsd / incomeUsd : 0;
  const freeAfterFixedAndDebt = incomeUsd - capacity.fixedCostsUsd - capacity.monthlyDebtUsd;

  const exportPdf = () => runExport(() => ({
    title: 'Reporte financiero',
    subtitle: `${monthLabel(month)} · salud ${health.score}/100`,
    fileName: 'reporte-financiero',
    cards: [
      { label: 'Ingreso propio', value: formatUsd(incomeUsd), tone: 'ok' as const },
      { label: 'Gastos', value: formatUsd(expenseUsd) },
      { label: 'Ahorro del mes', value: formatUsd(savings), hint: formatPct(savingsRate), tone: savings >= 0 ? 'ok' as const : 'danger' as const },
      { label: 'Deuda / ingreso', value: formatPct(capacity.ratio), hint: `Tope ${settings.maxDebtRatioPct}%`, tone: capacity.level === 'sano' ? 'ok' as const : capacity.level === 'alerta' ? 'warn' as const : 'danger' as const },
    ],
    bars: {
      title: 'A dónde se va el dinero',
      items: byCat.map((c) => ({ label: c.name, value: c.usd, display: formatUsd(c.usd), note: formatPct(c.share) })),
    },
    tables: [
      {
        title: 'Diagnóstico',
        head: ['Componente', 'Puntaje'],
        body: health.parts.map((p) => [p.label, `${p.value} de ${p.max}`]),
        foot: [['Salud financiera', `${health.score} de 100`]],
        alignRight: [1],
      },
      {
        title: 'Qué conviene hacer',
        accent: 'danger' as const,
        head: ['Prioridad', 'Recomendación'],
        body: advice.map((a) => [a.level === 'urgente' ? 'Urgente' : a.level === 'atencion' ? 'Atención' : 'Bien', `${a.title}. ${a.detail}`]),
      },
      {
        title: 'Capacidad de endeudamiento',
        head: ['Concepto', 'Monto'],
        body: [
          ['Ingreso propio del mes', formatUsd(capacity.incomeUsd)],
          ['Costos fijos', formatUsd(capacity.fixedCostsUsd)],
          ['Cuotas de deuda', formatUsd(capacity.monthlyDebtUsd)],
          [`Tope que te fijaste (${settings.maxDebtRatioPct}%)`, formatUsd(capacity.maxDebtUsd)],
          ['Podrías comprometer', formatUsd(capacity.availableUsd)],
          ['Libre tras fijos y cuotas', formatUsd(freeAfterFixedAndDebt)],
        ],
        alignRight: [1],
      },
      {
        title: 'Reparto del ingreso',
        accent: 'ok' as const,
        head: ['Grupo', 'Objetivo', 'Real', 'Diferencia'],
        body: groups.map((g) => [GROUP_LABEL[g.group], formatUsd(g.targetUsd), formatUsd(g.actualUsd), formatUsd(g.diffUsd)]),
        alignRight: [1, 2, 3],
      },
    ],
    footNote: inflation
      ? `El bolívar se devaluó ${formatPct(inflation.devaluationPct)} en tres meses (${formatPct(inflation.dailyPct)} diario). Cada 1.000 Bs guardados perdieron ${formatUsd(inflation.lossPer1000Bs)}.`
      : undefined,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Reportes</h1><p className="page-subtitle">Qué dicen tus números y qué conviene hacer con ellos este mes.</p></div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} label="Reporte PDF" />
          <MonthPicker month={month} onPrev={prev} onNext={next} />
        </div>
      </div>

      {/* 1. Diagnóstico */}
      <section className="card rep-health">
        <div className="rep-health-score">
          <span className="rep-score num">{health.score}</span>
          <span className="tiny muted">de 100</span>
          <span className={`tag ${health.score >= 70 ? 'ok' : health.score >= 45 ? 'warn' : 'danger'}`}>
            {health.score >= 70 ? 'Buena salud' : health.score >= 45 ? 'Mejorable' : 'Frágil'}
          </span>
        </div>
        <ul className="rep-health-parts">
          {health.parts.map((p) => (
            <li key={p.label}>
              <div className="row-between tiny"><span>{p.label}</span><span className="num">{p.value}/{p.max}</span></div>
              <ProgressBar ratio={p.value / p.max} color={p.value / p.max > 0.7 ? 'var(--color-ok)' : p.value / p.max > 0.4 ? 'var(--color-warn)' : 'var(--color-danger)'} />
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Qué hacer */}
      <section className="card">
        <div className="card-header"><h2 className="card-title">Qué conviene hacer</h2><span className="tag primary">{advice.length}</span></div>
        <ul className="rep-advice">
          {advice.map((a) => (
            <li key={a.id} className={`rep-advice-item ${a.level}`}>
              <span className="rep-advice-icon">{ADVICE_ICON[a.level]}</span>
              <div><p className="strong small">{a.title}</p><p className="small">{a.detail}</p></div>
            </li>
          ))}
          {advice.length === 0 && <li className="muted small">Sin observaciones este mes.</li>}
        </ul>
      </section>

      {/* 3. Números base */}
      <div className="grid grid-4">
        <StatCard tone="usd" icon={<TrendingUp size={18} />} label="Ingreso propio"
          value={<span className="num">{formatUsd(incomeUsd)}</span>} hint={`${monthIncomes.length} entradas`} />
        <StatCard tone={savings >= 0 ? 'ok' : 'danger'} icon={<PiggyBank size={18} />} label="Ahorro del mes"
          value={<span className={`num ${savings < 0 ? 'text-danger' : ''}`}>{formatUsd(savings)}</span>}
          hint={`${formatPct(savingsRate)} · meta ${settings.savingsTargetPct}%`} />
        <StatCard tone="bs" icon={<Users size={18} />} label="Gasto por persona"
          value={<span className="num">{formatUsd(perPerson)}</span>} hint={`Hogar de ${settings.householdSize}`} />
        <StatCard tone={freeAfterFixedAndDebt < 0 ? 'danger' : 'primary'} icon={<TrendingDown size={18} />} label="Libre tras fijos y cuotas"
          value={<span className="num">{formatUsd(freeAfterFixedAndDebt)}</span>} hint="Para vivir el resto del mes" />
      </div>

      {/* 4. Capacidad de endeudamiento */}
      <section className={`card rep-capacity ${capacity.level}`}>
        <div className="card-header">
          <h2 className="card-title">Capacidad de endeudamiento</h2>
          <span className={`tag ${capacity.level === 'sano' ? 'ok' : capacity.level === 'alerta' ? 'warn' : 'danger'}`}>{LEVEL_LABEL[capacity.level]}</span>
        </div>
        <div className="rep-capacity-grid">
          <dl className="kv">
            <div><dt>Ingreso propio del mes</dt><dd className="num">{formatUsd(capacity.incomeUsd)}</dd></div>
            <div><dt>Costos fijos ({formatPct(fixedRatio)})</dt><dd className="num">{formatUsd(capacity.fixedCostsUsd)}</dd></div>
            <div><dt>Cuotas de deuda del mes</dt><dd className="num">{formatUsd(capacity.monthlyDebtUsd)}</dd></div>
            <div><dt>Tope que te fijaste ({settings.maxDebtRatioPct}%)</dt><dd className="num">{formatUsd(capacity.maxDebtUsd)}</dd></div>
            <div className="rep-kv-main"><dt>Podrías comprometer</dt><dd className="num">{formatUsd(capacity.availableUsd)}</dd></div>
          </dl>
          <div className="rep-capacity-meter">
            <span className="rep-big num">{formatPct(capacity.ratio)}</span>
            <span className="tiny muted">de tu ingreso va a deuda</span>
            <ProgressBar ratio={capacity.ratio / (settings.maxDebtRatioPct / 100)}
              color={capacity.level === 'sano' ? 'var(--color-ok)' : capacity.level === 'alerta' ? 'var(--color-warn)' : 'var(--color-danger)'} />
            <p className="tiny muted">Una cuota nueva de más de <strong className="num">{formatUsd(capacity.availableUsd)}</strong> al mes te saca de tu propio límite.</p>
          </div>
        </div>
      </section>

      {/* 5. Distribución */}
      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Ingresos vs. gastos</h2><span className="tiny muted">6 meses</span></div>
          <BarChart bars={historyBars} format={(n) => formatUsd(n)} orientation="vertical" />
          <p className="tiny muted rep-note">Barra ancha: gasto. Barra fina gris: ingreso del mismo mes.</p>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Reparto {settings.split.necesidad}/{settings.split.deseo}/{settings.split.ahorro}</h2></div>
          <BarChart bars={groupBars} format={(n) => formatUsd(n)} valueLabel="Real" compareLabel="Objetivo" />
          <ul className="rep-groups">
            {groups.map((g) => (
              <li key={g.group} className="row-between tiny">
                <span>{GROUP_LABEL[g.group]}</span>
                <span className={g.diffUsd < 0 ? 'text-danger num' : 'text-ok num'}>{g.diffUsd < 0 ? `${formatUsd(-g.diffUsd)} por encima` : `${formatUsd(g.diffUsd)} libres`}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-header"><h2 className="card-title">A dónde se va el dinero</h2><span className="tiny muted">Real contra tope por rubro</span></div>
        <BarChart bars={categoryBars} format={(n) => formatUsd(n)} valueLabel="Gastado" compareLabel="Tope o sugerido" />
        <p className="tiny muted rep-note">Las barras rojas se pasaron de su tope. Ajusta topes en Presupuesto.</p>
      </section>

      {/* 6. Inflación */}
      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Inflación y devaluación</h2><span className="tag bs">Bs</span></div>
          {inflation ? (
            <dl className="kv">
              <div><dt>Devaluación (3 meses)</dt><dd className="num text-danger">{formatPct(inflation.devaluationPct)}</dd></div>
              <div><dt>Ritmo diario promedio</dt><dd className="num">{formatPct(inflation.dailyPct)}</dd></div>
              <div><dt>Pérdida por cada 1.000 Bs guardados</dt><dd className="num text-danger">{formatUsd(inflation.lossPer1000Bs)}</dd></div>
              <div><dt>Costo de esperar una semana</dt><dd className="num text-danger">{formatPct(inflation.dailyPct * 7)}</dd></div>
            </dl>
          ) : <p className="muted small">Registra tasas de al menos dos días para medir la devaluación.</p>}
          <p className="tiny muted rep-note">Si tienes {formatUsd(freeAfterFixedAndDebt > 0 ? freeAfterFixedAndDebt : 0)} libres en bolívares, esperar una semana para cambiarlos cuesta {inflation ? formatUsd(Math.max(0, freeAfterFixedAndDebt) * inflation.dailyPct * 7) : '—'}.</p>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Productos que más subieron</h2><span className="tag usd">en $</span></div>
          {products.length === 0 ? (
            <p className="muted small">Marca «sumar al inventario» al registrar compras: con dos o más compras del mismo producto verás su inflación real.</p>
          ) : (
            <BarChart bars={products.map((p) => ({ label: p.item.name, value: Math.round(p.changePct * 1000) / 10, color: p.changePct > 0 ? 'var(--color-danger)' : 'var(--color-ok)' }))}
              format={(n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`} />
          )}
          <p className="tiny muted rep-note">Subidas en dólares: no es la tasa, es el producto encareciéndose de verdad.</p>
        </section>
      </div>
    </div>
  );
}
