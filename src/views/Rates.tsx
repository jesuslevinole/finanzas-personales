import { useState, type FormEvent } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import Sparkline from '../components/ui/Sparkline';
import EmptyState from '../components/ui/EmptyState';
import { fetchBcvRate } from '../services/rates';
import type { ExchangeRate } from '../types';
import { inflationSummary } from '../utils/finance';
import { formatBs, formatPct, formatUsd } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Rates.css';

export default function Rates() {
  const { rates, set, del } = useData();
  const [date, setDate] = useState(todayIso());
  const [rate, setRate] = useState('');
  const [bsAmount, setBsAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState('');

  const latest = rates[0];
  const current = latest?.rate ?? 0;
  const last30 = [...rates].slice(0, 30).reverse();
  const summary = inflationSummary(last30);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = Number(rate);
    if (r <= 0) return;
    await set<ExchangeRate>('rates', date, { date, rate: r, source: 'manual' });
    setRate('');
  };

  const refresh = async () => {
    setFetching(true); setMsg('');
    const r = await fetchBcvRate();
    if (r) { await set<ExchangeRate>('rates', r.date, { date: r.date, rate: r.rate, source: 'BCV' }); setMsg(`Tasa BCV de hoy: ${formatBs(r.rate)}`); }
    else setMsg('No se pudo consultar la tasa. Ingrésala a mano.');
    setFetching(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Tasa BCV</h1><p className="page-subtitle">La tasa se guarda por día y se usa para convertir cada movimiento a dólares.</p></div>
        <button type="button" className="btn btn-outline" onClick={refresh} disabled={fetching}><RefreshCw size={16} /> Actualizar desde BCV</button>
      </div>
      {msg && <p className="small muted">{msg}</p>}

      <div className="grid grid-2">
        <section className="card">
          <span className="field-label">Tasa vigente</span>
          <span className="rates-big num">{current ? formatBs(current) : '—'}</span>
          {latest && <span className="tiny muted">{shortDate(latest.date)} · {latest.source}</span>}
          <Sparkline values={last30.map((r) => r.rate)} height={80} tone="danger" />
          {summary && <p className="small">En los últimos {summary.days} días el bolívar perdió <strong className="text-danger">{formatPct(summary.devaluationPct)}</strong>: 1.000 Bs valían {formatUsd(1000 / summary.firstRate)} y hoy valen {formatUsd(1000 / summary.lastRate)}.</p>}
        </section>

        <section className="card stack">
          <h2 className="card-title">Convertidor</h2>
          <div className="form-grid">
            <label className="field"><span className="field-label">Bolívares</span><input className="input num" type="number" step="0.01" value={bsAmount} onChange={(e) => { setBsAmount(e.target.value); setUsdAmount(current ? (Number(e.target.value) / current).toFixed(2) : ''); }} /></label>
            <label className="field"><span className="field-label">Dólares</span><input className="input num" type="number" step="0.01" value={usdAmount} onChange={(e) => { setUsdAmount(e.target.value); setBsAmount((Number(e.target.value) * current).toFixed(2)); }} /></label>
          </div>
          <h2 className="card-title">Registrar tasa manual</h2>
          <form onSubmit={submit} className="form-grid rates-form">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Fecha" />
            <input className="input num" type="number" step="0.0001" min="0" placeholder="Bs por $" value={rate} onChange={(e) => setRate(e.target.value)} required aria-label="Tasa" />
            <button type="submit" className="btn btn-primary">Guardar</button>
          </form>
        </section>
      </div>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Historial</h2></div>
        {rates.length === 0 ? <EmptyState title="Sin tasas" hint="Actualiza desde BCV o registra la tasa a mano." /> : (
          <ul>
            {rates.slice(0, 60).map((r, i) => {
              const prev = rates[i + 1];
              const change = prev ? r.rate / prev.rate - 1 : null;
              return (
                <li key={r.id} className="record">
                  <span className="record-date rates-date">{shortDate(r.date)}</span>
                  <span className="record-main"><span className="num strong">{formatBs(r.rate)}</span></span>
                  <span className="record-meta">
                    {change !== null && <span className={`tag ${change > 0 ? 'danger' : 'ok'}`}>{change > 0 ? '+' : ''}{formatPct(change)}</span>}
                    <span className="tag">{r.source}</span>
                  </span>
                  <span className="record-actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar la tasa del ${shortDate(r.date)}?`)) void del('rates', r.id); }}><Trash2 size={16} /></button></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
