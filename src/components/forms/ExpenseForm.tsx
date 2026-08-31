import { useState, type FormEvent } from 'react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import type { Category, Expense, InventoryItem, Place, PricePoint, Product } from '../../types';
import { rateForDate } from '../../utils/finance';
import { colorForIndex, getRelationName } from '../../utils/relations';
import { round2, toUsd } from '../../utils/money';
import { todayIso } from '../../utils/dates';
import './forms.css';

interface Props {
  /** Si viene, el formulario edita ese gasto en vez de crear uno nuevo. */
  expense?: Expense;
  onDone: () => void;
}

export default function ExpenseForm({ expense, onDone }: Props) {
  const data = useData();
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [placeId, setPlaceId] = useState(expense?.placeId ?? '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? data.categories[0]?.id ?? '');
  const [productId, setProductId] = useState(expense?.productId ?? '');
  const [priceCurrency, setPriceCurrency] = useState<'VES' | 'USD'>('VES');
  const [price, setPrice] = useState(expense ? String(expense.unitPriceBs) : '');
  const [quantity, setQuantity] = useState(String(expense?.quantity ?? 1));
  const [rate, setRate] = useState(String(expense?.rate ?? rateForDate(data.rates, todayIso(), data.currentRate) ?? ''));
  const [toStock, setToStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const priceNum = Number(price) || 0;
  const qtyNum = Number(quantity) || 0;
  const unitPriceBs = priceCurrency === 'VES' ? priceNum : priceNum * rateNum;
  const totalBs = round2(unitPriceBs * qtyNum);
  const totalUsd = round2(toUsd(totalBs, rateNum));

  const onDateChange = (d: string) => {
    setDate(d);
    if (!expense) setRate(String(rateForDate(data.rates, d, data.currentRate) || ''));
  };

  const product = getRelationName(data.products, productId, '');

  const createPlace = (name: string) => data.add<Place>('places', { name, color: colorForIndex(data.places.length), active: true });
  const createProduct = (name: string) => data.add<Product>('products', { name, color: colorForIndex(data.products.length), active: true });
  const createCategory = (name: string) => data.add<Category>('categories', { name, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId || !categoryId || rateNum <= 0 || priceNum <= 0) return;
    setSaving(true);
    const payload = { date, placeId, categoryId, productId, product, unitPriceBs: round2(unitPriceBs), quantity: qtyNum, totalBs, rate: rateNum, totalUsd };
    if (expense) {
      await data.update<Expense>('expenses', expense.id, payload);
    } else {
      await data.add<Expense>('expenses', payload);
      if (toStock) await addToStock();
    }
    setSaving(false);
    onDone();
  };

  const addToStock = async () => {
    const point: PricePoint = { date, priceBs: round2(unitPriceBs), priceUsd: round2(toUsd(unitPriceBs, rateNum)), rate: rateNum };
    const existing = data.inventory.find((i) => i.productId === productId
      || i.name.trim().toLowerCase() === product.trim().toLowerCase());
    if (existing) {
      await data.update<InventoryItem>('inventory', existing.id, {
        quantity: existing.quantity + qtyNum, lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd,
        lastPurchaseDate: date, lastPlaceId: placeId, priceHistory: [...existing.priceHistory, point],
      });
    } else {
      await data.add<InventoryItem>('inventory', {
        productId, name: product.trim(), categoryId, quantity: qtyNum, unit: 'und', minQuantity: 1,
        lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd, lastPurchaseDate: date, lastPlaceId: placeId, priceHistory: [point],
      });
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} required /></label>
        <label className="field"><span className="field-label">Tasa (Bs/$)</span><input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
      </div>
      <div className="field"><span className="field-label">Producto o concepto</span>
        <CustomSelect items={data.products} value={productId} onChange={setProductId} onCreate={createProduct} placeholder="Harina de maíz 1 kg" />
        <span className="field-hint">Si no está en la lista, escríbelo y usa «Crear».</span>
      </div>
      <div className="form-grid">
        <div className="field"><span className="field-label">Lugar</span><CustomSelect items={data.places} value={placeId} onChange={setPlaceId} onCreate={createPlace} placeholder="Maraplus, Yummy…" /></div>
        <div className="field"><span className="field-label">Rubro</span><CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId} onCreate={createCategory} placeholder="Víveres, Proteína…" /></div>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Precio unitario</span>
          <div className="form-price">
            <input className="input num" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
            <button type="button" className={`btn btn-outline form-cur${priceCurrency === 'USD' ? ' usd' : ''}`} onClick={() => setPriceCurrency((c) => (c === 'VES' ? 'USD' : 'VES'))}>{priceCurrency === 'VES' ? 'Bs' : '$'}</button>
          </div>
        </label>
        <label className="field"><span className="field-label">Cantidad</span><input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label>
      </div>
      <dl className="form-summary">
        <div><dt>Total Bs</dt><dd className="num text-bs">{totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</dd></div>
        <div><dt>Total $</dt><dd className="num text-usd">{totalUsd.toFixed(2)}</dd></div>
      </dl>
      {!expense && (
        <label className="row small"><input type="checkbox" checked={toStock} onChange={(e) => setToStock(e.target.checked)} /> Sumar al inventario (guarda el precio para medir inflación)</label>
      )}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{expense ? 'Guardar cambios' : 'Guardar gasto'}</button></div>
    </form>
  );
}
