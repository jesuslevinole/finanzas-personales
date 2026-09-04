import { useCallback, useState } from 'react';
import { exportReport, type ReportSpec } from '../utils/pdf';

/** Estado del botón de exportar mientras se genera el PDF. */
export function useExport() {
  const [exporting, setExporting] = useState(false);

  const run = useCallback(async (build: () => ReportSpec) => {
    setExporting(true);
    try {
      await exportReport(build());
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, run };
}
