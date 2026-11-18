import { code128Bars } from '@/lib/domain/code128';

/** Impresoras térmicas de 203 dpi: el módulo (barra más fina) se mide en puntos de impresión para que no se difumine. */
const DPI = 203;
const QUIET = 10; // zona de silencio a cada lado, en módulos
const MAX_WIDTH_IN = 3.5;

/**
 * Código de barras Code 128 como SVG vectorial. El tamaño físico se fija en pulgadas
 * (módulo de 2 a 4 puntos) para que el lector lo escanee igual en pantalla, PDF o térmica.
 */
export default function Barcode128({ value, heightIn = 0.7 }: { value: string; heightIn?: number }) {
  const { bars, modules } = code128Bars(value);
  const total = modules + QUIET * 2;
  const dots = Math.max(2, Math.min(4, Math.floor((MAX_WIDTH_IN * DPI) / total)));
  const widthIn = (total * dots) / DPI;

  return (
    <svg
      role="img"
      aria-label={`Código de barras ${value}`}
      width={`${widthIn.toFixed(4)}in`}
      height={`${heightIn}in`}
      viewBox={`${-QUIET} 0 ${total} 1`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={1} fill="#000" />
      ))}
    </svg>
  );
}
