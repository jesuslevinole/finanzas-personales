import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useMonth } from '../hooks/useMonth';
import MonthPicker from '../components/ui/MonthPicker';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import EmptyState from '../components/ui/EmptyState';
import type { Expense, Income, InventoryItem, MoneyOwner, NewDoc, PricePoint } from '../types';
import { rateForDate } from '../utils/finance';
import { getCategoryColor, getCategoryName } from '../utils/relations';
import { round2, sum, toUsd } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Movements.css';

type Tab = 'gastos' | 'ingresos';

export default function Movements() {
  const { categories, rates, currentRate, inventory, add, del, update } = useData();
  const { month, prev, next, monthIncomes, monthExpenses } = useMonth();
  const [tab, setTab] = useState<Tab>('gastos');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? monthExpenses.filter((e) => `${e.product} ${e.place}`.toLowerCase().includes(q)) : monthExpenses;
  }, [monthExpenses, search]);

  const totalExp = sum(monthExpenses.map((e) => e.totalUsd));
  const totalInc = sum(monthIncomes.map((i) => i.amountUsd));

  const confirmDelete = (name: string, id: string) => {
    if (window.confirm(`¿Eliminar "${name}"?`)) void del(tab === 'gastos' ? 'expenses' : 'incomes', id);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Movimientos</h1><p className="page-subtitle">Cada registro guarda la tasa del día. El dólar es la vara, el bolívar es el medio.</p></div>
        <MonthPicker month={month} onPrev={prev} onNext={next} />
      </div>

      <div className="row-between wrap">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'gastos'} className={`tab${tab === 'gastos' ? ' active' : ''}`} onClick={() => setTab('gastos')}>Gastos <span className="num muted">{monthExpenses.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'ingresos'} className={`tab${tab === 'ingresos' ? ' active' : ''}`} onClick={() => setTab('ingresos')}>Ingresos <span className="num muted">{monthIncomes.length}</span></button>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Total del mes</h2>
          <Money amount={tab === 'gastos' ? totalExp : totalInc} currency="USD" rate={currentRate} dual />
        </div>
        {tab === 'gastos' && <input className="input" placeholder="Buscar producto o lugar…" value={search} onChange={(e) => setSearch(e.target.value)} />}

        {tab === 'gastos' ? (
          filteredExpenses.length === 0 ? <EmptyState title="Sin gastos" hint="Registra lo que compras, con precio y cantidad, para saber en qué se va el dinero." /> : (
            <ul className="mov-list">
              {filteredExpenses.map((e) => (
                <li key={e.id} className="list-item">
                  <div className="mov-date"><span className="tiny muted">{shortDate(e.date)}</span></div>
                  <div className="grow">
                    <div className="strong truncate">{e.product}{e.quantity !== 1 && <span className="muted tiny"> × {e.quantity}</span>}</div>
                    <div className="row tiny muted"><span className="truncate">{e.place}</span><span className="tag cat" style={{ '--tag-color': getCategoryColor(categories, e.categoryId) } as CSSProperties}>{getCategoryName(categories, e.categoryId)}</span></div>
                  </div>
                  <Money amount={e.totalUsd} currency="USD" rate={e.rate} dual size="sm" />
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => confirmDelete(e.product, e.id)}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )
        ) : (
          monthIncomes.length === 0 ? <EmptyState title="Sin ingresos" hint="Registra lo que entra, y marca como 'tercero' el dinero que solo pasa por tu cuenta." /> : (
            <ul className="mov-list">
              {monthIncomes.map((i) => (
                <li key={i.id} className="list-item">
                  <div className="mov-date"><span className="tiny muted">{shortDate(i.date)}</span></div>
                  <div className="grow"><div className="strong truncate">{i.source}</div><div className="tiny muted">{i.note}</div></div>
                  <span className={`tag ${i.owner === 'propio' ? 'ok' : ''}`}>{i.owner}</span>
                  <Money amount={i.amountUsd} currency="USD" rate={i.rate} dual size="sm" />
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => confirmDelete(i.source, i.id)}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <Modal title={tab === 'gastos' ? 'Nuevo gasto' : 'Nuevo ingreso'} open={open} onClose={() => setOpen(false)}>
        {tab === 'gastos' ? (
          <ExpenseForm
            categories={categories} rates={rates} currentRate={currentRate} inventory={inventory}
            onSubmit={async (exp, stock) => {
              const id = await add<Expense>('expenses', exp);
              if (stock) await stock(id);
              setOpen(false);
            }}
            addInventory={(data) => add<InventoryItem>('inventory', data)}
            updateInventory={(id, data) => update<InventoryItem>('inventory', id, data)}
          />
        ) : (
          <IncomeForm rates={rates} currentRate={currentRate} onSubmit={async (inc) => { await add<Income>('incomes', inc); setOpen(false); }} />
        )}
      </Modal>
    </div>
  );
}

/* ---------- Formulario de gasto ---------- */

interface ExpenseFormProps {
  categories: ReturnType<typeof useData>['categories'];
  rates: ReturnType<typeof useData>['rates'];
  inventory: InventoryItem[];
  currentRate: number;
  onSubmit: (exp: NewDoc<Expense>, stock: ((expenseId: string) => Promise<void>) | null) => Promise<void>;
  addInventory: (data: NewDoc<InventoryItem>) => Promise<string>;
  updateInventory: (id: string, data: Partial<NewDoc<InventoryItem>>) => Promise<void>;
}

function ExpenseForm({ categories, rates, inventory, currentRate, onSubmit, addInventory, updateInventory }: ExpenseFormProps) {
  const [date, setDate] = useState(todayIso());
  const [place, setPlace] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [product, setProduct] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<'VES' | 'USD'>('VES');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rate, setRate] = useState(String(rateForDate(rates, todayIso(), currentRate) || ''));
  const [toStock, setToStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const priceNum = Number(price) || 0;
  const qtyNum = Number(quantity) || 0;
  const unitPriceBs = priceCurrency === 'VES' ? priceNum : priceNum * rateNum;
  const totalBs = round2(unitPriceBs * qtyNum);
  const totalUsd = round2(toUsd(totalBs, rateNum));

  const onDateChange = (d: string) => { setDate(d); setRate(String(rateForDate(rates, d, currentRate) || '')); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product || !categoryId || rateNum <= 0 || priceNum <= 0) return;
    setSaving(true);
    const exp: NewDoc<Expense> = { date, place, categoryId, product, unitPriceBs: round2(unitPriceBs), quantity: qtyNum, totalBs, rate: rateNum, totalUsd };
    const stock = toStock ? async () => {
      const point: PricePoint = { date, priceBs: round2(unitPriceBs), priceUsd: round2(toUsd(unitPriceBs, rateNum)), rate: rateNum };
      const existing = inventory.find((i) => i.name.trim().toLowerCase() === product.trim().toLowerCase());
      if (existing) {
        await updateInventory(existing.id, {
          quantity: existing.quantity + qtyNum, lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd,
          lastPurchaseDate: date, lastPlace: place, priceHistory: [...existing.priceHistory, point],
        });
      } else {
        await addInventory({ name: product.trim(), categoryId, quantity: qtyNum, unit: 'und', minQuantity: 1, lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd, lastPurchaseDate: date, lastPlace: place, priceHistory: [point] });
      }
    } : null;
    await onSubmit(exp, stock);
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Tasa (Bs/$)</span><input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      </div>
      <label className="field"><span className="field-label">Producto o concepto</span><input className="input" value={product} onChange={(e) => setProduct(e.target.value)} list="inventory-names" placeholder="Harina de maíz 1 kg" required /></label>
      <datalist id="inventory-names">{inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      <div className="form-grid">
        <label className="field"><span className="field-label">Lugar</span><input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Maraplus, Yummy, Digitel…" /></label>
        <label className="field"><span className="field-label">Rubro</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.length === 0 && <option value="">Crea rubros en Ajustes</option>}
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
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

interface IncomeFormProps {
  rates: ReturnType<typeof useData>['rates'];
  currentRate: number;
  onSubmit: (inc: NewDoc<Income>) => Promise<void>;
}

function IncomeForm({ rates, currentRate, onSubmit }: IncomeFormProps) {
  const [date, setDate] = useState(todayIso());
  const [source, setSource] = useState('');
  const [amountBs, setAmountBs] = useState('');
  const [rate, setRate] = useState(String(rateForDate(rates, todayIso(), currentRate) || ''));
  const [owner, setOwner] = useState<MoneyOwner>('propio');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const bs = Number(amountBs) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!source || bs <= 0 || rateNum <= 0) return;
    setSaving(true);
    await onSubmit({ date, source, amountBs: bs, rate: rateNum, amountUsd: round2(toUsd(bs, rateNum)), owner, note: note || undefined });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setRate(String(rateForDate(rates, e.target.value, currentRate) || '')); }} required /></label>
        <label className="field"><span className="field-label">Tasa (Bs/$)</span><input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      </div>
      <label className="field"><span className="field-label">Origen</span><input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Cliente, Binance, alquiler…" required /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto en Bs</span><input className="input num" type="number" step="0.01" min="0" value={amountBs} onChange={(e) => setAmountBs(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Dinero</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}>
            <option value="propio">Propio</option>
            <option value="tercero">De un tercero (solo pasa por mi cuenta)</option>
          </select>
        </label>
      </div>
      <label className="field"><span className="field-label">Nota</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <p className="field-hint">Equivale a <strong className="text-usd num">${round2(toUsd(bs, rateNum)).toFixed(2)}</strong> a la tasa indicada.</p>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>Guardar ingreso</button></div>
    </form>
  );
}
