import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImageUp, Loader2, ScanText } from 'lucide-react';
import { scanInvoice, type ScannedInvoice } from '../../services/invoiceScan';
import './InvoiceScanButton.css';

interface Props {
  onScanned: (invoice: ScannedInvoice) => void;
}

/**
 * Toma (o elige) la foto de una factura y la manda a leer. Dos entradas: la
 * cámara directa en el teléfono y la galería/archivo para fotos ya tomadas.
 */
export default function InvoiceScanButton({ onScanned }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    setError('');
    setSummary('');
    try {
      const invoice = await scanInvoice(file);
      if (invoice.items.length === 0 && !invoice.total) {
        setError('No se encontraron productos ni total en la foto. Intenta con más luz y la factura completa en el cuadro.');
        return;
      }
      setSummary(`Leídos ${invoice.items.length} producto${invoice.items.length === 1 ? '' : 's'}${invoice.merchant ? ` de ${invoice.merchant}` : ''}. Revisa antes de guardar.`);
      onScanned(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la factura.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className={`scan-box${error ? ' error' : ''}`}>
      <div className="scan-box-head">
        <span className="chip-icon scan-box-icon">{scanning ? <Loader2 size={18} className="scan-spin" /> : <ScanText size={18} />}</span>
        <div className="grow">
          <p className="strong small">{scanning ? 'Leyendo la factura…' : 'Llenar desde la factura'}</p>
          <p className="tiny muted">{scanning ? 'Puede tardar unos segundos.' : 'Toma una foto y se cargan los productos y precios.'}</p>
        </div>
      </div>
      <div className="scan-box-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={scanning} onClick={() => cameraRef.current?.click()}>
          <Camera size={16} /> Tomar foto
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={scanning} onClick={() => fileRef.current?.click()}>
          <ImageUp size={16} /> Subir imagen
        </button>
      </div>
      {summary && <p className="tiny text-ok">{summary}</p>}
      {error && <p className="tiny text-danger" role="alert">{error}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void handleFile(e)} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void handleFile(e)} />
    </div>
  );
}
