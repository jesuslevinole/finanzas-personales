import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import type { Bank, Category, Expense, Invoice, MoneyOwner, Place, Product } from '../../types';
import { rateForDate } from '../../utils/finance';
import { colorForIndex, getRelationName } from '../../utils/relations';
import { formatBs, formatUsd, round2, sum, toUsd } from '../../utils/money';
import { todayIso } from '../../utils/dates';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import './forms.css';

interface Line {
  key: string;
  productId: string;
  categoryId: string;
  quantity: string;
  priceBs: string;
}

const emptyLine = (categoryId: string): Line => ({
  key: Math.random().toString(36).slice(2),
  productId: '', categoryId, quantity: '1', priceBs: '',
});

/**
 * Factura con varias líneas: crea un gasto por producto y los agrupa bajo un
 * mismo documento, para poder verlos juntos o por separado.
 */
export default function InvoiceForm({ onDone }: { onDone: () => void }) {
  const data = useData();
  const { placeId: currentPlaceId } = useCurrentPlace();
  const defaultCategory = data.categories[0]?.id ?? '';

  const [date, setDate] = useState(todayIso());
  const [number, setNumber] = useState('');
  const [concept, setConcept] = useState('');
  const [placeId, setPlaceId] = useState(currentPlaceId);
  const [bankId, setBankId] = useState('');
  const [owner, setOwner] = useState<MoneyOwner>('propio');
  const [rate, setRate] = useState(String(rateForDate(data.rates, todayIso(), data.currentRate)));
  const [lines, setLines] = useState<Line[]>([emptyLine(defaultCategory)]);
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate) || 0;
  const lineTotalBs = (line: Line) => round2((Number(line.priceBs) || 0) * (Number(line.quantity) || 0));
  const totalBs = round2(sum(lines.map(lineTotalBs)));
  const totalUsd = round2(toUsd(totalBs, rateNum));
  const valid = lines.some((l) => l.productId && lineTotalBs(l) > 0) && rateNum > 0;

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Al elegir el producto se hereda su rubro por defecto. */
  const pickProduct = (key: string, productId: string) => {
    const product = data.products.find((p) => p.id === productId);
    update(key, { productId, ...(product?.categoryId ? { categoryId: product.categoryId } : {}) });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      const invoiceId = await data.add<Invoice>('invoices', {
        date, number: number.trim() || undefined,
        concept: concept.trim() || getRelationName(data.places, placeId, 'Compra'),
        placeId: placeId || undefined, bankId: bankId || undefined, owner, rate: rateNum,
      });

      for (const line of lines) {
        const bs = lineTotalBs(line);
        if (!line.productId || bs <= 0) continue;
        const quantity = Number(line.quantity) || 1;
        await data.add<Expense>('expenses', {
          date, placeId, categoryId: line.categoryId, productId: line.productId,
          product: getRelationName(data.products, line.productId, 'Producto'),
          bankId: bankId || undefined, owner, invoiceId,
          unitPriceBs: round2(Number(line.priceBs) || 0), quantity,
          totalBs: bs, rate: rateNum, totalUsd: round2(toUsd(bs, rateNum)),
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha</span>
          <input className="input" type="date" value={date} required
            onChange={(e) => { setDate(e.target.value); setRate(String(rateForDate(data.rates, e.target.value, data.currentRate))); }} />
        </label>
        <label className="field"><span className="field-label">Nº de factura</span>
          <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Opcional" />
        </label>
      </div>

      <label className="field"><span className="field-label">Concepto</span>
        <input className="input" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Compra de la semana, farmacia…" />
      </label>

      <div className="form-grid">
        <div className="field"><span className="field-label">Lugar</span>
          <CustomSelect items={data.places} value={placeId} onChange={setPlaceId}
            onCreate={(name) => data.add<Place>('places', { name, color: colorForIndex(data.places.length), active: true })} />
        </div>
        <div className="field"><span className="field-label">Banco o medio</span>
          <CustomSelect items={data.banks} value={bankId} onChange={setBankId}
            onCreate={(name) => data.add<Bank>('banks', { name, color: colorForIndex(data.banks.length), active: true })} />
        </div>
      </div>

      <div className="form-grid">
        <label className="field"><span className="field-label">Tasa (Bs/$)</span>
          <input className="input num" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Dinero</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}>
            <option value="propio">Propio</option>
            <option value="tercero">De un tercero</option>
          </select>
        </label>
      </div>

      <span className="field-label">Productos de la factura</span>
      <ul className="invoice-lines">
        {lines.map((line) => (
          <li key={line.key} className="invoice-line">
            <div className="invoice-line-product">
              <CustomSelect items={data.products} value={line.productId} onChange={(id) => pickProduct(line.key, id)}
                onCreate={(name) => data.add<Product>('products', { name, color: colorForIndex(data.products.length), active: true, unit: 'und' })}
                placeholder="Producto" />
            </div>
            <div className="invoice-line-fields">
              <CustomSelect items={data.categories} value={line.categoryId} onChange={(id) => update(line.key, { categoryId: id })}
                onCreate={(name) => data.add<Category>('categories', { name, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' })}
                placeholder="Rubro" />
              <input className="input num" type="number" inputMode="decimal" step="any" min="0" value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })} aria-label="Cantidad" placeholder="Cant." />
              <input className="input num" type="number" inputMode="decimal" step="any" min="0" value={line.priceBs}
                onChange={(e) => update(line.key, { priceBs: e.target.value })} aria-label="Precio unitario en bolívares" placeholder="Precio Bs" />
              <span className="invoice-line-total num">{formatBs(lineTotalBs(line))}</span>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar línea"
                onClick={() => setLines((c) => (c.length > 1 ? c.filter((l) => l.key !== line.key) : c))}>
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-outline" onClick={() => setLines((c) => [...c, emptyLine(defaultCategory)])}>
        <Plus size={16} /> Agregar línea
      </button>

      <dl className="form-summary">
        <div><dt>Total Bs</dt><dd className="num text-bs">{formatBs(totalBs)}</dd></div>
        <div><dt>Total $</dt><dd className="num text-usd">{formatUsd(totalUsd)}</dd></div>
      </dl>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
          {saving ? 'Guardando…' : `Guardar factura (${lines.filter((l) => l.productId).length} productos)`}
        </button>
      </div>
    </form>
  );
}
