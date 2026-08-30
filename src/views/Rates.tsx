import { useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { useData } from '../hooks/useData';
import Sparkline from '../components/ui/Sparkline';
import DetailSheet from '../components/ui/DetailSheet';
import { useConfirm } from '../hooks/useConfirm';
import DataTable, { type Column } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import { fetchBcvRate } from '../services/rates';
import type { ExchangeRate } from '../types';
import { inflationSummary } from '../utils/finance';
import { formatBs, formatPct, formatUsd } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import { sequenceMap } from '../utils/sequence';
import './Rates.css';

export default function Rates() {
  const { rates, set, del } = useData();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayIso());
  const [rate, setRate] = useState('');
  const [bsAmount, setBsAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<ExchangeRate | null>(null);

  const latest = rates[0];
  const current = latest?.rate ?? 0;
  const last30 = [...rates].slice(0, 30).reverse();
  const summary = inflationSummary(last30);

  const seq = sequenceMap(rates, (r) => r.date);

  const rateColumns: Column<ExchangeRate>[] = [
    { key: 'seq', header: '#', width: '54px', render: (r) => <span className="seq num">{seq.get(r.id)}</span> },
    { key: 'date', header: 'Fecha', width: '110px', primary: true, render: (r) => shortDate(r.date) },
    { key: 'change', header: 'Variación', width: '120px', render: (r) => {
      const i = rates.findIndex((x) => x.id === r.id);
      const prev = rates[i + 1];
      if (!prev) return <span className="muted">—</span>;
      const change = r.rate / prev.rate - 1;
      return <span className={`tag ${change > 0 ? 'danger' : 'ok'}`}>{change > 0 ? '+' : ''}{formatPct(change)}</span>;
    } },
    { key: 'source', header: 'Fuente', width: '100px', hideOnMobile: true, render: (r) => <span className="tag">{r.source}</span> },
    { key: 'rate', header: 'Bs por $', align: 'end', width: '130px', render: (r) => <span className="strong num text-bs">{formatBs(r.rate)}</span> },
  ];

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

      <section className="card card-tight">
        <div className="card-header"><h2 className="card-title">Historial</h2><span className="tag">{rates.length} días</span></div>
        <DataTable rows={rates.slice(0, 90)} columns={rateColumns} onRowClick={setDetail}
          empty={<EmptyState title="Sin tasas" hint="Actualiza desde BCV o registra la tasa a mano." />} />
      </section>

      {detail && (
        <DetailSheet open title={`Tasa del ${shortDate(detail.date)}`} subtitle={`Fuente: ${detail.source}`}
          onClose={() => setDetail(null)}
          onDelete={async () => {
            const ok = await confirm({ title: `¿Eliminar la tasa del ${shortDate(detail.date)}?`, message: 'Los movimientos ya registrados conservan la tasa con la que se guardaron.', confirmLabel: 'Eliminar', danger: true });
            if (!ok) return;
            await del('rates', detail.id);
            setDetail(null);
          }}
          fields={[
            { label: 'Bs por dólar', value: <span className="num text-bs">{formatBs(detail.rate)}</span> },
            { label: 'Fecha', value: shortDate(detail.date) },
            { label: '1.000 Bs equivalen a', value: <span className="num text-usd">{formatUsd(1000 / detail.rate)}</span> },
            { label: '$100 equivalen a', value: <span className="num text-bs">{formatBs(detail.rate * 100)}</span> },
          ]} />
      )}
    </div>
  );
}
