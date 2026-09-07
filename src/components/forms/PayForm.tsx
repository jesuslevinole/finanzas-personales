import { useState, type FormEvent } from 'react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import type { Category, Expense, Place, WalletMove } from '../../types';
import { rateForDate } from '../../utils/finance';
import { colorForIndex } from '../../utils/relations';
import { formatBs, formatUsd, round2, toBs } from '../../utils/money';
import { todayIso } from '../../utils/dates';
import './forms.css';

interface Props {
  /** Qué se está pagando: aparece como concepto del gasto. */
  concept: string;
  amountUsd: number;
  /** Se ejecuta con el id del gasto creado (o vacío si no se registró ninguno). */
  onPaid: (expenseId: string | undefined, paidDate: string) => Promise<void>;
}

/**
 * Registra el pago de una cuota o costo fijo. Crea el gasto correspondiente y
 * devuelve su id, para que la deuda quede enlazada con el movimiento que la saldó.
 */
export default function PayForm({ concept, amountUsd, onPaid }: Props) {
  const data = useData();
  const [date, setDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? '');
  const [placeId, setPlaceId] = useState('');
  const [rate, setRate] = useState(String(rateForDate(data.rates, todayIso(), data.currentRate)));
  const [createExpense, setCreateExpense] = useState(true);
  const [fromWallet, setFromWallet] = useState(false);
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const totalBs = round2(toBs(amountUsd, rateNum));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let expenseId: string | undefined;
      if (createExpense && categoryId) {
        expenseId = await data.add<Expense>('expenses', {
          date, placeId, categoryId, product: concept,
          unitPriceBs: totalBs, quantity: 1, totalBs, rate: rateNum, totalUsd: amountUsd,
          note: 'Pago registrado desde el módulo de pagos',
        });
      }
      if (fromWallet) {
        // Salida de la billetera: los dólares se cambian para cubrir este pago.
        await data.add<WalletMove>('walletMoves', {
          date, kind: 'salida', amountUsd, rate: rateNum, amountBs: totalBs,
          concept, linkedExpenseId: expenseId,
        });
      }
      await onPaid(expenseId, date);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <dl className="kv form-summary-kv">
        <div><dt>Concepto</dt><dd>{concept}</dd></div>
        <div><dt>Monto</dt><dd className="num text-usd">{formatUsd(amountUsd)}</dd></div>
        <div><dt>En bolívares</dt><dd className="num text-bs">{formatBs(totalBs)}</dd></div>
      </dl>

      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha del pago</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); setRate(String(rateForDate(data.rates, e.target.value, data.currentRate))); }} />
        </label>
        <label className="field"><span className="field-label">Tasa usada (Bs/$)</span>
          <input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
          <span className="field-hint">Si pagaste con dólares de Binance, usa esa tasa.</span>
        </label>
      </div>

      <label className="row small"><input type="checkbox" checked={createExpense} onChange={(e) => setCreateExpense(e.target.checked)} /> Registrar el gasto en Movimientos</label>

      {createExpense && (
        <div className="form-grid">
          <div className="field"><span className="field-label">Rubro</span>
            <CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId}
              onCreate={(name) => data.add<Category>('categories', { name, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' })} />
          </div>
          <div className="field"><span className="field-label">Lugar / medio</span>
            <CustomSelect items={data.places} value={placeId} onChange={setPlaceId}
              onCreate={(name) => data.add<Place>('places', { name, color: colorForIndex(data.places.length), active: true })}
              placeholder="Banco, Binance…" />
          </div>
        </div>
      )}

      <label className="row small"><input type="checkbox" checked={fromWallet} onChange={(e) => setFromWallet(e.target.checked)} /> Salió de mis dólares (registrar salida en Divisas)</label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || (createExpense && !categoryId)}>
          {saving ? 'Registrando…' : 'Marcar como pagada'}
        </button>
      </div>
    </form>
  );
}
