import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import './BarcodeScanner.css';

/** Tipos mínimos de la API BarcodeDetector (aún no está en lib.dom). */
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const getDetector = (): BarcodeDetectorCtor | null => {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
};

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

/**
 * Lector de códigos de barras con la cámara trasera. Usa `BarcodeDetector`,
 * disponible en Chrome de Android y escritorio; en navegadores sin soporte se
 * avisa y se puede escribir el código a mano.
 */
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) {
      setError('Tu navegador no puede leer códigos con la cámara. Escríbelo a mano abajo.');
      return;
    }

    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found.length > 0 && found[0].rawValue) { onDetected(found[0].rawValue); return; }
          } catch {
            // Un fotograma ilegible no es un fallo: se sigue intentando.
          }
          timer = window.setTimeout(() => void scan(), 400);
        };
        void scan();
      } catch {
        setError('No se pudo abrir la cámara. Revisa los permisos del navegador.');
      }
    };

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="scanner-backdrop" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <div className="scanner">
        <div className="scanner-head">
          <span className="strong"><Camera size={16} /> Escanear código</span>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {error ? (
          <p className="scanner-error small">{error}</p>
        ) : (
          <div className="scanner-view">
            <video ref={videoRef} className="scanner-video" playsInline muted />
            <span className="scanner-frame" aria-hidden="true" />
            <p className="tiny scanner-hint">Apunta al código de barras del producto</p>
          </div>
        )}

        <form className="scanner-manual" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onDetected(manual.trim()); }}>
          <input className="input num" inputMode="numeric" placeholder="O escribe el código" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Código de barras" />
          <button type="submit" className="btn btn-primary" disabled={!manual.trim()}>Usar</button>
        </form>
      </div>
    </div>
  );
}
