import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import { usePermissions } from '../hooks/usePermissions';
import MonthPicker from '../components/ui/MonthPicker';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import CustomSelect from '../components/ui/CustomSelect';
import type { Category, Expense, Income, IncomeSource, InventoryItem, MoneyOwner, Place, PricePoint } from '../types';
import { rateForDate } from '../utils/finance';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { round2, sum, toUsd } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Movements.css';

type Tab = 'gastos' | 'ingresos';

export default function Movements() {
  const data = useData();
  const { canEdit } = usePermissions();
  const { month, prev, next, monthIncomes, monthExpenses } = useMonth();
  const [tab, setTab] = useState<Tab>('gastos');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const editable = canEdit('movimientos');

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return monthExpenses;
    return monthExpenses.filter((e) => `${e.product} ${getRelationName(data.places, e.placeId, '')}`.toLowerCase().includes(q));
  }, [monthExpenses, search, data.places]);

  const totalExp = sum(monthExpenses.map((e) => e.totalUsd));
  const totalInc = sum(monthIncomes.map((i) => i.amountUsd));

  const confirmDelete = (name: string, id: string) => {
    if (window.confirm(`¿Eliminar «${name}»?`)) void data.del(tab === 'gastos' ? 'expenses' : 'incomes', id);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Movimientos</h1><p className="page-subtitle">Cada registro guarda la tasa del día. El dólar es la vara, el bolívar el medio.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="row-between wrap">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'gastos'} className={`tab${tab === 'gastos' ? ' active' : ''}`} onClick={() => setTab('gastos')}>Gastos <span className="num muted">{monthExpenses.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'ingresos'} className={`tab${tab === 'ingresos' ? ' active' : ''}`} onClick={() => setTab('ingresos')}>Ingresos <span className="num muted">{monthIncomes.length}</span></button>
        </div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'}</button>}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Total del mes</h2>
          <Money amount={tab === 'gastos' ? totalExp : totalInc} currency="USD" rate={data.currentRate} dual />
        </div>
        {tab === 'gastos' && <input className="input mov-search" placeholder="Buscar producto o lugar…" value={search} onChange={(e) => setSearch(e.target.value)} />}

        {tab === 'gastos' ? (
          filteredExpenses.length === 0 ? <EmptyState title="Sin gastos" hint="Registra lo que compras, con precio y cantidad, para saber en qué se va el dinero." /> : (
            <ul className="mov-list">
              {filteredExpenses.map((e) => (
                <li key={e.id} className="record">
                  <span className="record-date">{shortDate(e.date)}</span>
                  <span className="record-main">
                    <span className="record-title">{e.product}</span>
                    {e.quantity !== 1 && <span className="tiny muted num">× {e.quantity}</span>}
                  </span>
                  <span className="record-meta">
                    <span className="tag cat truncate" style={{ '--tag-color': getRelationColor(data.categories, e.categoryId) } as CSSProperties}>{getRelationName(data.categories, e.categoryId)}</span>
                    <span className="truncate">{getRelationName(data.places, e.placeId, '—')}</span>
                  </span>
                  <span className="record-amount"><Money amount={e.totalUsd} currency="USD" rate={e.rate} dual size="sm" /></span>
                  {editable && <span className="record-actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => confirmDelete(e.product, e.id)}><Trash2 size={16} /></button></span>}
                </li>
              ))}
            </ul>
          )
        ) : (
          monthIncomes.length === 0 ? <EmptyState title="Sin ingresos" hint="Registra lo que entra, y marca como «tercero» el dinero que solo pasa por tu cuenta." /> : (
            <ul className="mov-list">
              {monthIncomes.map((i) => (
                <li key={i.id} className="record">
                  <span className="record-date">{shortDate(i.date)}</span>
                  <span className="record-main"><span className="record-title">{getRelationName(data.incomeSources, i.sourceId, 'Sin origen')}</span></span>
                  <span className="record-meta">
                    <span className={`tag ${i.owner === 'propio' ? 'ok' : ''}`}>{i.owner}</span>
                    {i.note && <span className="truncate">{i.note}</span>}
                  </span>
                  <span className="record-amount"><Money amount={i.amountUsd} currency="USD" rate={i.rate} dual size="sm" /></span>
                  {editable && <span className="record-actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => confirmDelete(getRelationName(data.incomeSources, i.sourceId, 'ingreso'), i.id)}><Trash2 size={16} /></button></span>}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <Modal title={tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'} open={open} onClose={() => setOpen(false)}>
        {tab === 'gastos'
          ? <ExpenseForm onDone={() => setOpen(false)} />
          : <IncomeForm onDone={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}

/* ---------- Formulario de gasto ---------- */

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const data = useData();
  const [date, setDate] = useState(todayIso());
  const [placeId, setPlaceId] = useState('');
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? '');
  const [product, setProduct] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<'VES' | 'USD'>('VES');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rate, setRate] = useState(String(rateForDate(data.rates, todayIso(), data.currentRate) || ''));
  const [toStock, setToStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const priceNum = Number(price) || 0;
  const qtyNum = Number(quantity) || 0;
  const unitPriceBs = priceCurrency === 'VES' ? priceNum : priceNum * rateNum;
  const totalBs = round2(unitPriceBs * qtyNum);
  const totalUsd = round2(toUsd(totalBs, rateNum));

  const onDateChange = (d: string) => { setDate(d); setRate(String(rateForDate(data.rates, d, data.currentRate) || '')); };

  const createPlace = (name: string) => data.add<Place>('places', { name, color: colorForIndex(data.places.length), active: true });
  const createCategory = (name: string) => data.add<Category>('categories', { name, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product || !categoryId || rateNum <= 0 || priceNum <= 0) return;
    setSaving(true);
    await data.add<Expense>('expenses', { date, placeId, categoryId, product, unitPriceBs: round2(unitPriceBs), quantity: qtyNum, totalBs, rate: rateNum, totalUsd });
    if (toStock) {
      const point: PricePoint = { date, priceBs: round2(unitPriceBs), priceUsd: round2(toUsd(unitPriceBs, rateNum)), rate: rateNum };
      const existing = data.inventory.find((i) => i.name.trim().toLowerCase() === product.trim().toLowerCase());
      if (existing) {
        await data.update<InventoryItem>('inventory', existing.id, {
          quantity: existing.quantity + qtyNum, lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd,
          lastPurchaseDate: date, lastPlaceId: placeId, priceHistory: [...existing.priceHistory, point],
        });
      } else {
        await data.add<InventoryItem>('inventory', {
          name: product.trim(), categoryId, quantity: qtyNum, unit: 'und', minQuantity: 1,
          lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd, lastPurchaseDate: date, lastPlaceId: placeId, priceHistory: [point],
        });
      }
    }
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Tasa (Bs/$)</span><input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      </div>
      <label className="field"><span className="field-label">Producto o concepto</span><input className="input" value={product} onChange={(e) => setProduct(e.target.value)} list="inventory-names" placeholder="Harina de maíz 1 kg" required /></label>
      <datalist id="inventory-names">{data.inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      <div className="form-grid">
        <div className="field"><span className="field-label">Lugar</span><CustomSelect items={data.places} value={placeId} onChange={setPlaceId} onCreate={createPlace} placeholder="Maraplus, Yummy…" /></div>
        <div className="field"><span className="field-label">Rubro</span><CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId} onCreate={createCategory} placeholder="Víveres, Proteína…" /></div>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Precio unitario</span>
          <div className="mov-price">
            <input className="input num" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
            <button type="button" className={`btn btn-outline mov-cur${priceCurrency === 'USD' ? ' usd' : ''}`} onClick={() => setPriceCurrency((c) => (c === 'VES' ? 'USD' : 'VES'))}>{priceCurrency === 'VES' ? 'Bs' : '$'}</button>
          </div>
        </label>
        <label className="field"><span className="field-label">Cantidad</span><input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label>
      </div>
      <dl className="mov-summary">
        <div><dt>Total Bs</dt><dd className="num text-bs">{totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</dd></div>
        <div><dt>Total $</dt><dd className="num text-usd">{totalUsd.toFixed(2)}</dd></div>
      </dl>
      <label className="row small"><input type="checkbox" checked={toStock} onChange={(e) => setToStock(e.target.checked)} /> Sumar al inventario (guarda el precio para medir inflación)</label>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>Guardar gasto</button></div>
    </form>
  );
}

/* ---------- Formulario de ingreso ---------- */

function IncomeForm({ onDone }: { onDone: () => void }) {
  const data = useData();
  const [date, setDate] = useState(todayIso());
  const [sourceId, setSourceId] = useState('');
  const [amountBs, setAmountBs] = useState('');
  const [rate, setRate] = useState(String(rateForDate(data.rates, todayIso(), data.currentRate) || ''));
  const [owner, setOwner] = useState<MoneyOwner>('propio');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const bs = Number(amountBs) || 0;

  const createSource = (name: string) => data.add<IncomeSource>('incomeSources', { name, color: colorForIndex(data.incomeSources.length), active: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sourceId || bs <= 0 || rateNum <= 0) return;
    setSaving(true);
    await data.add<Income>('incomes', { date, sourceId, amountBs: bs, rate: rateNum, amountUsd: round2(toUsd(bs, rateNum)), owner, note: note || undefined });
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setRate(String(rateForDate(data.rates, e.target.value, data.currentRate) || '')); }} required /></label>
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
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>Guardar ingreso</button></div>
    </form>
  );
}
