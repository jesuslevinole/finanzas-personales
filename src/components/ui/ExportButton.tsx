import { FileDown } from 'lucide-react';

interface Props {
  onClick: () => void;
  exporting: boolean;
  label?: string;
}

/** Botón estándar de «exportar a PDF», igual en todos los módulos. */
export default function ExportButton({ onClick, exporting, label = 'PDF' }: Props) {
  return (
    <button type="button" className="btn btn-outline" onClick={onClick} disabled={exporting}>
      <FileDown size={16} /> {exporting ? 'Generando…' : label}
    </button>
  );
}
