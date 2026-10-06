import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function Barcode({ value, compact = false }: { value: string; compact?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    JsBarcode(ref.current, value, {
      format: 'CODE128', displayValue: true, fontSize: compact ? 12 : 15,
      height: compact ? 42 : 62, margin: 0, width: compact ? 1.4 : 1.8
    });
  }, [value, compact]);
  return <svg ref={ref} className="max-w-full" aria-label={`Código de barras ${value}`} />;
}
