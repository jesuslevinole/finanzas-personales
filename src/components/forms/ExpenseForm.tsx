import { useState, type FormEvent } from 'react';
import { useData } from '../../hooks/useData';
import { Barcode } from 'lucide-react';
import CustomSelect from '../ui/CustomSelect';
import { barcodeSupported } from '../../utils/barcode';
import BarcodeScanner from '../ui/BarcodeScanner';
import type { Category, Expense, InventoryItem, Place, PricePoint, Product, ProductType, StockUnit } from '../../types';
import { UNITS } from '../../utils/units';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import Modal from '../ui/Modal';
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
  const { placeId: currentPlaceId } = useCurrentPlace();
  const [date, setDate] = useState(expense?.date ?? todayIso());
  // Si marcaste dónde estás, el gasto nuevo arranca con ese lugar.
  const [placeId, setPlaceId] = useState(expense?.placeId ?? currentPlaceId);
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? data.categories[0]?.id ?? '');
  const [productId, setProductId] = useState(expense?.productId ?? '');
  const [priceCurrency, setPriceCurrency] = useState<'VES' | 'USD'>('VES');
  const [price, setPrice] = useState(expense ? String(expense.unitPriceBs) : '');
  const [quantity, setQuantity] = useState(String(expense?.quantity ?? 1));
  const [rate, setRate] = useState(String(expense?.rate ?? rateForDate(data.rates, todayIso(), data.currentRate) ?? ''));
  const [toStock, setToStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);

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
  const createProduct = (name: string) => data.add<Product>('products', { name, color: colorForIndex(data.products.length), active: true, unit: 'und' });

  /** Al elegir un producto se precarga su rubro por defecto. */
  const pickProduct = (id: string) => {
    setProductId(id);
    const chosen = data.products.find((p) => p.id === id);
    if (chosen?.categoryId) setCategoryId(chosen.categoryId);
    setScanMsg('');
  };

  /** Busca el código en el catálogo; si no está, ofrece darlo de alta ahí mismo. */
  const onScanned = (code: string) => {
    setScanning(false);
    const found = data.products.find((p) => p.barcode === code);
    if (found) { pickProduct(found.id); setScanMsg(`Encontrado: ${found.name}`); return; }
    setNewCode(code);
  };
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
        <div className="form-scan">
          <CustomSelect items={data.products} value={productId} onChange={pickProduct} onCreate={createProduct} placeholder="Harina de maíz 1 kg" />
          {barcodeSupported() && (
            <button type="button" className="btn btn-outline form-scan-btn" onClick={() => setScanning(true)} aria-label="Escanear código de barras">
              <Barcode size={18} />
            </button>
          )}
        </div>
        <span className="field-hint">{scanMsg || 'Si no está en la lista, escríbelo y usa «Crear».'}</span>
      </div>
      {scanning && <BarcodeScanner onDetected={onScanned} onClose={() => setScanning(false)} />}
      <Modal title="Producto nuevo" open={newCode !== null} onClose={() => setNewCode(null)}>
        {newCode && (
          <QuickProductForm code={newCode} defaultCategoryId={categoryId}
            onCreated={(id) => { pickProduct(id); setNewCode(null); setScanMsg('Producto agregado al catálogo.'); }} />
        )}
      </Modal>
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


/** Alta rápida de un producto escaneado, sin salir del formulario de gasto. */
function QuickProductForm({ code, defaultCategoryId, onCreated }: { code: string; defaultCategoryId: string; onCreated: (id: string) => void }) {
  const data = useData();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [typeId, setTypeId] = useState('');
  const [unit, setUnit] = useState<StockUnit>('und');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const id = await data.add<Product>('products', {
      name: name.trim(), color: colorForIndex(data.products.length), active: true,
      categoryId: categoryId || undefined, typeId: typeId || undefined, unit, barcode: code,
    });
    setSaving(false);
    onCreated(id);
  };

  return (
    <form onSubmit={submit} className="stack">
      <p className="small muted">Código <strong className="num">{code}</strong> no está en el catálogo. Dale nombre y queda listo para la próxima.</p>
      <label className="field"><span className="field-label">Nombre del producto</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Arroz Mary 1 kg" required autoFocus />
      </label>
      <div className="form-grid">
        <div className="field"><span className="field-label">Rubro</span>
          <CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId}
            onCreate={(value) => data.add<Category>('categories', { name: value, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' })} />
        </div>
        <div className="field"><span className="field-label">Tipo</span>
          <CustomSelect items={data.productTypes} value={typeId} onChange={setTypeId}
            onCreate={(value) => data.add<ProductType>('productTypes', { name: value, color: colorForIndex(data.productTypes.length), active: true })}
            placeholder="Arroz, pasta…" />
        </div>
      </div>
      <label className="field"><span className="field-label">Presentación</span>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>Agregar y usar</button></div>
    </form>
  );
}
