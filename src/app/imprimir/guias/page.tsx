import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { getLabelData } from '@/lib/guides';
import GuideLabel from '@/components/guides/GuideLabel';
import AutoPrint, { PrintNowButton } from './AutoPrint';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Imprimir guías' };

const MAX_LABELS = 150;

/**
 * Hoja de etiquetas 4x6 in, una por página. Vive fuera del layout del panel para que
 * al imprimir no salga el menú. ?ids=a,b,c  ·  ?auto=1 abre el diálogo de impresión solo.
 */
export default async function PrintGuidesPage({ searchParams }: { searchParams: Promise<{ ids?: string; auto?: string }> }) {
  await requireStaff();
  const { ids, auto } = await searchParams;
  const wanted = Array.from(new Set((ids ?? '').split(',').map((s) => s.trim()).filter(Boolean))).slice(0, MAX_LABELS);
  const all = wanted.length ? await getLabelData(wanted) : [];
  const labels = all.filter((l) => !l.voided);
  const skipped = all.length - labels.length;

  return (
    <>
      {/* El tamaño de la hoja es el de la etiqueta; el margen lo controla la propia etiqueta. */}
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e9ecec; }
        .sheet { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px 0 40px; }
        .sheet > section { box-shadow: 0 1px 6px rgba(0,0,0,.25); }
        .bar { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 14px 16px 0; font-family: Arial, sans-serif; font-size: 14px; }
        .bar a { color: inherit; }
        @media print {
          html, body { background: #fff !important; }
          .bar { display: none !important; }
          .sheet { display: block; padding: 0; }
          .sheet > section { box-shadow: none; }
        }
      `}</style>

      <div className="bar">
        <Link href="/guias">← Guías</Link>
        <span>
          <strong>{labels.length}</strong> etiqueta(s) · 4 × 6 pulgadas
          {skipped > 0 && ` · ${skipped} anulada(s) omitida(s)`}
        </span>
        {labels.length > 0 && <PrintNowButton />}
      </div>

      {labels.length === 0 ? (
        <p style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif', padding: 40 }}>No hay guías para imprimir.</p>
      ) : (
        <div className="sheet">
          {labels.map((l) => (
            <GuideLabel key={l.id} label={l} />
          ))}
        </div>
      )}

      <AutoPrint auto={auto === '1' && labels.length > 0} />
    </>
  );
}
