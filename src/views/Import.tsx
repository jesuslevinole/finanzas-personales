import { useState, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import type { Category, Creditor, Debt, ExchangeRate, Expense, FixedCost, Income, IncomeSource, NewDoc, Place, Product, ShoppingItem } from '../types';
import { matrixToLooseRows, matrixToRows, parseWorkbook, resolveKey, type Cell, type ParsedWorkbook, type RawRow } from '../utils/excel';
import { formatUsd, sum } from '../utils/money';
import './Import.css';

type Step = 'idle' | 'reading' | 'preview' | 'importing' | 'done' | 'error';

interface Selection {
  rates: boolean; incomes: boolean; expenses: boolean; fixedCosts: boolean; debts: boolean; shopping: boolean;
}

const SHEET_LABEL: Record<keyof Selection, string> = {
  rates: 'Tasas BCV', incomes: 'Ingresos', expenses: 'Gastos',
  fixedCosts: 'Costos fijos', debts: 'Deudas y cuotas', shopping: 'Lista de compras y urgencias',
};

export default function Import() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const [step, setStep] = useState<Step>('idle');
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [fileName, setFileName] = useState('');
  const [selection, setSelection] = useState<Selection>({ rates: true, incomes: true, expenses: true, fixedCosts: true, debts: true, shopping: true });
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [wiping, setWiping] = useState(false);
  const [wipeMessage, setWipeMessage] = useState('');

  if (!canEdit('importar')) {
    return <div className="page"><div className="card"><p className="muted">Tu rol no permite importar datos.</p></div></div>;
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep('reading');
    setMessage('');
    try {
      // Carga diferida: SheetJS solo se descarga cuando de verdad se importa.
      const XLSX = await import('xlsx');
            // Sin `cellDates`: preferimos el serial numérico, que no depende de la zona horaria.
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      const sheets: Record<string, RawRow[]> = {};
      wb.SheetNames.forEach((name) => {
        const matrix = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, defval: '', raw: true });
        const rows = matrixToRows(matrix);
        // LISTA no tiene encabezados: se lee por posición.
        sheets[name] = rows.length > 0 ? rows : matrixToLooseRows(matrix);
      });
      setParsed(parseWorkbook(sheets, data));
      setStep('preview');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
      setStep('error');
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setStep('importing');
    try {
      // 1) Catálogos nuevos primero: sus ids se necesitan en los movimientos.
      setProgress('Creando catálogos…');
      const map = new Map<string, string>();
      const createCatalog = async (drafts: typeof parsed.newCategories, collection: 'categories' | 'places' | 'creditors' | 'incomeSources' | 'products') => {
        for (const draft of drafts) {
          let id: string;
          if (collection === 'categories') {
            id = await data.add<Category>('categories', { name: draft.name, color: draft.color, active: true, group: 'necesidad' });
          } else if (collection === 'products') {
            id = await data.add<Product>('products', { name: draft.name, color: draft.color, active: true, unit: 'und' });
          } else {
            id = await data.add<Place | Creditor | IncomeSource>(collection, { name: draft.name, color: draft.color, active: true });
          }
          map.set(draft.name.toLowerCase(), id);
        }
      };
      await createCatalog(parsed.newCategories, 'categories');
      await createCatalog(parsed.newProducts, 'products');
      await createCatalog(parsed.newPlaces, 'places');
      await createCatalog(parsed.newCreditors, 'creditors');
      await createCatalog(parsed.newSources, 'incomeSources');

      const note = (label: string) => (done: number, total: number) => setProgress(`${label}: ${done} de ${total}`);

      if (selection.rates && parsed.rates.length) {
        setProgress('Guardando tasas…');
        for (const r of parsed.rates) await data.set<ExchangeRate>('rates', r.date, r);
      }
      if (selection.incomes && parsed.incomes.length) {
        const rows: NewDoc<Income>[] = parsed.incomes.map((i) => ({ ...i, sourceId: resolveKey(i.sourceId, map) }));
        await data.addMany<Income>('incomes', rows, note('Ingresos'));
      }
      if (selection.expenses && parsed.expenses.length) {
        const rows: NewDoc<Expense>[] = parsed.expenses.map((x) => ({
          ...x,
          placeId: resolveKey(x.placeId, map),
          categoryId: resolveKey(x.categoryId, map),
          productId: x.productId ? resolveKey(x.productId, map) : undefined,
        }));
        await data.addMany<Expense>('expenses', rows, note('Gastos'));
      }
      if (selection.fixedCosts && parsed.fixedCosts.length) await data.addMany<FixedCost>('fixedCosts', parsed.fixedCosts, note('Costos fijos'));
      if (selection.debts && parsed.debts.length) {
        const rows: NewDoc<Debt>[] = parsed.debts.map((d) => ({ ...d, creditorId: resolveKey(d.creditorId, map) }));
        await data.addMany<Debt>('debts', rows, note('Deudas'));
      }
      if (selection.shopping && parsed.shopping.length) await data.addMany<ShoppingItem>('shopping', parsed.shopping, note('Lista de compras'));

      setStep('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'La importación falló.');
      setStep('error');
    }
  };

  /** Deja el espacio vacío para reimportar sin duplicar. No toca roles ni ajustes. */
  const wipeData = async () => {
    const ok = await confirm({
      title: '¿Vaciar todos los datos?',
      message: 'Se borran movimientos, deudas, costos fijos, tasas, inventario, lista de compras y catálogos. No afecta a roles ni ajustes. Esto no se puede deshacer.',
      confirmLabel: 'Sí, borrar todo', danger: true,
    });
    if (!ok) return;
    setWiping(true);
    setWipeMessage('');
    try {
      let total = 0;
      for (const name of ['expenses', 'incomes', 'fixedCosts', 'debts', 'budgets', 'shopping', 'shoppingLists', 'inventory', 'rates', 'categories', 'products', 'productTypes', 'places', 'creditors', 'incomeSources'] as const) {
        setWipeMessage(`Borrando ${name}…`);
        total += await data.delAll(name);
      }
      setWipeMessage(`Listo: ${total} registros borrados. Ya puedes importar de nuevo.`);
    } catch (err) {
      setWipeMessage(err instanceof Error ? err.message : 'No se pudo borrar.');
    } finally {
      setWiping(false);
    }
  };

  const counts: [keyof Selection, number][] = parsed
    ? [['rates', parsed.rates.length], ['incomes', parsed.incomes.length], ['expenses', parsed.expenses.length],
       ['fixedCosts', parsed.fixedCosts.length], ['debts', parsed.debts.length], ['shopping', parsed.shopping.length]]
    : [];
  const newCatalogs = parsed ? parsed.newCategories.length + parsed.newProducts.length + parsed.newPlaces.length + parsed.newCreditors.length + parsed.newSources.length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Importar Excel</h1><p className="page-subtitle">Lee tu modelo actual y lo convierte al formato de la app, creando los catálogos que falten.</p></div>
      </div>

      <section className="card">
        <label className="import-drop">
          <FileSpreadsheet size={28} />
          <span className="strong">{fileName || 'Selecciona tu archivo .xlsx'}</span>
          <span className="tiny muted">Hojas que se leen: TASA_BCV, BD_INGRESOS, BD_GASTOS, BD_COSTOSFIJOS, BD_DEUDAS, LISTA, URGENCIAS</span>
          <input type="file" accept=".xlsx,.xlsm,.xls" className="import-file" onChange={onFile} />
          <span className="btn btn-primary"><Upload size={16} /> Elegir archivo</span>
        </label>
        {step === 'reading' && <p className="small muted import-status">Leyendo el archivo…</p>}
        {step === 'error' && <p className="small text-danger import-status"><AlertTriangle size={14} /> {message}</p>}
      </section>

      {parsed && (step === 'preview' || step === 'importing' || step === 'done') && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Qué se va a importar</h2>{newCatalogs > 0 && <span className="tag primary">{newCatalogs} catálogos nuevos</span>}</div>
          <ul className="import-list">
            {counts.map(([key, count]) => (
              <li key={key} className="import-row">
                <input type="checkbox" className="import-check" checked={selection[key]} disabled={count === 0 || step !== 'preview'}
                  onChange={() => setSelection((s) => ({ ...s, [key]: !s[key] }))} aria-label={SHEET_LABEL[key]} />
                <span className="grow">{SHEET_LABEL[key]}</span>
                <span className={`tag ${count > 0 ? 'primary' : ''}`}>{count} registros</span>
              </li>
            ))}
          </ul>

          <dl className="import-summary">
            <div><dt>Gastos</dt><dd className="num">{formatUsd(sum(parsed.expenses.map((e) => e.totalUsd)))}</dd></div>
            <div><dt>Ingresos</dt><dd className="num">{formatUsd(sum(parsed.incomes.map((i) => i.amountUsd)))}</dd></div>
            <div><dt>Deuda</dt><dd className="num">{formatUsd(sum(parsed.debts.map((d) => d.amountUsd)))}</dd></div>
          </dl>

          {parsed.warnings.length > 0 && (
            <details className="import-warnings">
              <summary>{parsed.warnings.length} filas se saltaron</summary>
              <ul>{parsed.warnings.slice(0, 30).map((w) => <li key={w} className="tiny muted">{w}</li>)}</ul>
            </details>
          )}

          {step === 'preview' && (
            <div className="form-actions"><button type="button" className="btn btn-primary" onClick={runImport}>Importar a Firestore</button></div>
          )}
          {step === 'importing' && <p className="small muted import-status">{progress || 'Importando…'}</p>}
          {step === 'done' && (
            <p className="small text-ok import-status"><CheckCircle2 size={14} /> Importación completa. Revisa Movimientos y Catálogos; los rubros nuevos entraron como «necesidad», ajústalos en Catálogos.</p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Vaciar datos</h2>
        <p className="small muted import-wipe-text">Si una importación quedó a medias o quieres empezar limpio, borra los datos antes de reintentar. No afecta a usuarios, roles ni ajustes.</p>
        <button type="button" className="btn btn-danger" onClick={wipeData} disabled={wiping}><Trash2 size={16} /> Borrar movimientos y catálogos</button>
        {wipeMessage && <p className="small import-status">{wipeMessage}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Antes de importar</h2>
        <ul className="import-tips">
          <li>Se agregan registros, no se reemplazan: si importas dos veces, tendrás duplicados.</li>
          <li>Las fechas en serial de Excel (46249) se convierten solas.</li>
          <li>Si una fila no trae tasa, se usa la del día más cercano anterior.</li>
          <li>Los montos de costos fijos y deudas se toman como dólares; los de gastos e ingresos, como bolívares.</li>
        </ul>
      </section>
    </div>
  );
}
