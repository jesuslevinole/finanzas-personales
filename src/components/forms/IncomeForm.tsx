import { useState, type FormEvent } from 'react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import type { Income, IncomeSource, MoneyOwner } from '../../types';
import { rateForDate } from '../../utils/finance';
import { colorForIndex } from '../../utils/relations';
import { round2, toUsd } from '../../utils/money';
import { todayIso } from '../../utils/dates';
import './forms.css';

interface Props {
  income?: Income;
  onDone: () => void;
}

export default function IncomeForm({ income, onDone }: Props) {
  const data = useData();
  const [date, setDate] = useState(income?.date ?? todayIso());
  const [sourceId, setSourceId] = useState(income?.sourceId ?? '');
  const [amountBs, setAmountBs] = useState(income ? String(income.amountBs) : '');
  const [rate, setRate] = useState(String(income?.rate ?? rateForDate(data.rates, todayIso(), data.currentRate) ?? ''));
  const [owner, setOwner] = useState<MoneyOwner>(income?.owner ?? 'propio');
  const [note, setNote] = useState(income?.note ?? '');
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const bs = Number(amountBs) || 0;

  const createSource = (name: string) => data.add<IncomeSource>('incomeSources', { name, color: colorForIndex(data.incomeSources.length), active: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sourceId || bs <= 0 || rateNum <= 0) return;
    setSaving(true);
    const payload = { date, sourceId, amountBs: bs, rate: rateNum, amountUsd: round2(toUsd(bs, rateNum)), owner, note: note || undefined };
    if (income) await data.update<Income>('incomes', income.id, payload);
    else await data.add<Income>('incomes', payload);
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); if (!income) setRate(String(rateForDate(data.rates, e.target.value, data.currentRate) || '')); }} />
        </label>
        <label className="field"><span className="field-label">Tasa (Bs/$)</span><input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      </div>
      <div className="field"><span className="field-label">Origen</span><CustomSelect items={data.incomeSources} value={sourceId} onChange={setSourceId} onCreate={createSource} placeholder="Cliente, alquiler, Binance…" /></div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto en Bs</span><input className="input num" type="number" step="0.01" min="0" value={amountBs} onChange={(e) => setAmountBs(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Dinero</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}>
            <option value="propio">Propio</option>
            <option value="tercero">De un tercero</option>
          </select>
        </label>
      </div>
      <label className="field"><span className="field-label">Nota</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <p className="field-hint">Equivale a <strong className="text-usd num">${round2(toUsd(bs, rateNum)).toFixed(2)}</strong> a la tasa indicada.</p>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{income ? 'Guardar cambios' : 'Guardar ingreso'}</button></div>
    </form>
  );
}
