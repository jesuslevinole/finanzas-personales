import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import ProgressBar from '../components/ui/ProgressBar';
import Sparkline from '../components/ui/Sparkline';
import { debtCapacity, emergencyFundTarget, expensesByCategory, groupTargets, GROUP_LABEL, inflationSummary, ownIncomeUsd, productInflation } from '../utils/finance';
import { formatPct, formatUsd, sum } from '../utils/money';
import { addMonths, monthLabel, monthOf } from '../utils/dates';
import './Reports.css';

const LEVEL_LABEL = { sano: 'Sano', alerta: 'En alerta', critico: 'Crítico' } as const;

export default function Reports() {
  const { categories, rates, incomes, expenses, inventory, settings } = useData();
  const { month, prev, next, monthIncomes, monthExpenses, monthFixed, monthDebts } = useMonth();

  const incomeUsd = ownIncomeUsd(monthIncomes);
  const expenseUsd = sum(monthExpenses.map((e) => e.totalUsd));
  const capacity = debtCapacity(incomeUsd, monthDebts, monthFixed, settings);
  const groups = groupTargets(incomeUsd, monthExpenses, monthDebts.filter((d) => d.status === 'pagada'), categories, settings);
  const savingsRate = incomeUsd > 0 ? (incomeUsd - expenseUsd - sum(monthDebts.filter((d) => d.status === 'pagada' && d.owner === 'propio').map((d) => d.amountUsd))) / incomeUsd : 0;
  const emergency = emergencyFundTarget(monthFixed, settings.emergencyFundMonths);
  const inflation = inflationSummary(rates.filter((r) => r.date >= addMonths(month, -2) + '-01' && monthOf(r.date) <= month));
  const products = productInflation(inventory).slice(0, 8);
  const topCats = expensesByCategory(monthExpenses, categories).slice(0, 5);

  /** Últimos 6 meses: ingresos vs gastos en USD. */
  const history = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
    return months.map((m) => ({
      month: m,
      income: ownIncomeUsd(incomes.filter((i) => monthOf(i.date) === m)),
      expense: sum(expenses.filter((e) => monthOf(e.date) === m).map((e) => e.totalUsd)),
    }));
  }, [month, incomes, expenses]);

  const fixedRatio = incomeUsd > 0 ? capacity.fixedCostsUsd / incomeUsd : 0;
  const freeAfterFixedAndDebt = incomeUsd - capacity.fixedCostsUsd - capacity.monthlyDebtUsd;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Reportes</h1><p className="page-subtitle">Lo que los números dicen de tu mes, en dólares BCV.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <section className={`card report-capacity ${capacity.level}`}>
        <div className="card-header">
          <h2 className="card-title">Capacidad de endeudamiento</h2>
          <span className={`tag ${capacity.level === 'sano' ? 'ok' : capacity.level === 'alerta' ? 'warn' : 'danger'}`}>{LEVEL_LABEL[capacity.level]}</span>
        </div>
        <div className="report-capacity-grid">
          <dl className="kv report-kv">
            <div><dt>Ingreso propio del mes</dt><dd className="num">{formatUsd(capacity.incomeUsd)}</dd></div>
            <div><dt>Costos fijos ({formatPct(fixedRatio)})</dt><dd className="num">{formatUsd(capacity.fixedCostsUsd)}</dd></div>
            <div><dt>Cuotas de deuda este mes</dt><dd className="num">{formatUsd(capacity.monthlyDebtUsd)}</dd></div>
            <div><dt>Tope recomendado de deuda ({settings.maxDebtRatioPct}%)</dt><dd className="num">{formatUsd(capacity.maxDebtUsd)}</dd></div>
            <div className="report-kv-main"><dt>Aún podrías comprometer en cuotas</dt><dd className="num">{formatUsd(capacity.availableUsd)}</dd></div>
          </dl>
          <div className="report-capacity-meter">
            <span className="report-big num">{formatPct(capacity.ratio)}</span>
            <span className="tiny muted">de tu ingreso va a deuda</span>
            <ProgressBar ratio={capacity.ratio / (settings.maxDebtRatioPct / 100)} color={capacity.level === 'sano' ? 'var(--color-ok)' : capacity.level === 'alerta' ? 'var(--color-warn)' : 'var(--color-danger)'} />
            <p className="tiny muted">Después de fijos y cuotas te quedan <strong className={`num ${freeAfterFixedAndDebt < 0 ? 'text-danger' : ''}`}>{formatUsd(freeAfterFixedAndDebt)}</strong> para vivir el mes.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">¿Cuánto deberías gastar?</h2></div>
          <ul className="stack">
            {groups.map((g) => (
              <li key={g.group} className="row-between small">
                <span><span className="strong">{GROUP_LABEL[g.group]}</span> <span className="muted">· {g.targetPct}%</span></span>
                <span className="num"><strong>{formatUsd(g.targetUsd)}</strong> <span className={g.diffUsd < 0 ? 'text-danger' : 'muted'}>(llevas {formatUsd(g.actualUsd)})</span></span>
              </li>
            ))}
          </ul>
          <hr className="report-sep" />
          <p className="small strong">Donde más se va el dinero</p>
          <ul className="stack">
            {topCats.map((c) => <li key={c.categoryId} className="row-between small"><span>{c.name}</span><span className="num">{formatUsd(c.usd)} <span className="muted">({formatPct(c.share)})</span></span></li>)}
            {topCats.length === 0 && <li className="muted small">Sin gastos este mes.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Salud financiera</h2></div>
          <dl className="kv report-kv">
            <div><dt>Tasa de ahorro</dt><dd className={`num ${savingsRate < 0 ? 'text-danger' : savingsRate >= 0.2 ? 'text-ok' : ''}`}>{formatPct(savingsRate)}</dd></div>
            <div><dt>Fondo de emergencia objetivo ({settings.emergencyFundMonths} meses de fijos)</dt><dd className="num">{formatUsd(emergency)}</dd></div>
            <div><dt>Costos fijos / ingreso</dt><dd className={`num ${fixedRatio > 0.5 ? 'text-danger' : ''}`}>{formatPct(fixedRatio)}</dd></div>
          </dl>
          <ul className="report-tips">
            {savingsRate < 0 && <li className="danger"><AlertTriangle size={14} /> Gastaste más de lo que entró. Revisa deseos y cuotas antes de asumir nuevas.</li>}
            {savingsRate >= 0 && savingsRate < 0.1 && <li className="warn"><AlertTriangle size={14} /> Ahorro por debajo del 10%. El primer objetivo es un colchón de {formatUsd(emergency)} en dólares.</li>}
            {savingsRate >= 0.2 && <li className="ok"><ShieldCheck size={14} /> Ahorras 20% o más. Mantén el excedente en divisas, no en bolívares.</li>}
            {fixedRatio > 0.5 && <li className="warn"><AlertTriangle size={14} /> Más de la mitad del ingreso son costos fijos: poco margen ante un mes flojo.</li>}
          </ul>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header"><h2 className="card-title">Ingresos vs. gastos (6 meses)</h2></div>
          <Sparkline values={history.map((h) => h.income)} height={70} tone="usd" />
          <Sparkline values={history.map((h) => h.expense)} height={70} tone="danger" />
          <ul className="report-history">
            {history.map((h) => (
              <li key={h.month}><span className="tiny muted">{monthLabel(h.month).slice(0, 3)}</span><span className="tiny num text-usd">{formatUsd(h.income)}</span><span className="tiny num text-danger">{formatUsd(h.expense)}</span></li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Inflación real</h2><span className="tag bs">Bs</span></div>
          {inflation ? (
            <dl className="kv report-kv">
              <div><dt>Devaluación (últimos 3 meses)</dt><dd className="num text-danger">{formatPct(inflation.devaluationPct)}</dd></div>
              <div><dt>Ritmo diario promedio</dt><dd className="num">{formatPct(inflation.dailyPct)}</dd></div>
              <div><dt>Pérdida por cada 1.000 Bs guardados</dt><dd className="num text-danger">{formatUsd(inflation.lossPer1000Bs)}</dd></div>
            </dl>
          ) : <p className="muted small">Registra tasas de al menos dos días para medir la devaluación.</p>}
          <hr className="report-sep" />
          <p className="small strong">Productos que más subieron (en $)</p>
          {products.length === 0 ? <p className="muted small">Marca "sumar al inventario" al registrar compras: con dos o más compras del mismo producto verás su inflación real.</p> : (
            <ul className="stack">
              {products.map((p) => (
                <li key={p.item.id} className="row-between small">
                  <span className="truncate">{p.item.name}</span>
                  <span className={`row num ${p.changePct > 0 ? 'text-danger' : 'text-ok'}`}>{p.changePct > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{formatPct(p.changePct)} <span className="muted">({formatUsd(p.firstUsd)} → {formatUsd(p.lastUsd)})</span></span>
                </li>
              ))}
            </ul>
          )}
          <ul className="report-tips">
            <li className="ok"><ShieldCheck size={14} /> Convierte el excedente a divisas el mismo día que cobras; cada día en Bs cuesta {inflation ? formatPct(inflation.dailyPct) : 'dinero'}.</li>
            <li className="ok"><ShieldCheck size={14} /> Compra no perecederos cuando su precio en $ esté por debajo de tu historial.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
