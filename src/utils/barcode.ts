/** true si el navegador puede leer códigos de barras con la cámara. */
export const barcodeSupported = (): boolean =>
  'BarcodeDetector' in window && typeof navigator.mediaDevices?.getUserMedia === 'function';
