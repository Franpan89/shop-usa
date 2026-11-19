import Link from 'next/link';
import { pageWindow, type PageInfo } from '@/lib/domain/pagination';

/**
 * Paginador para listas largas. Navega por enlaces (?pagina=2) y conserva los demás filtros de la URL.
 * No se imprime: en papel salen todas las filas (ver `.screen-hidden` en la página).
 */
export default function Pagination({
  info,
  basePath,
  params = {},
  paramName = 'pagina',
}: {
  info: PageInfo;
  basePath: string;
  params?: Record<string, string | undefined>;
  paramName?: string;
}) {
  if (info.total <= info.size) return null;

  const href = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (page > 1) q.set(paramName, String(page));
    else q.delete(paramName);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav className="row-between no-print" aria-label="Paginación" style={{ padding: '12px 4px 0', flexWrap: 'wrap', gap: 10 }}>
      <span className="muted small">
        Mostrando {info.start + 1}–{info.end} de {info.total}
      </span>
      <div className="row" style={{ gap: 6 }}>
        {info.page > 1 ? (
          <Link href={href(info.page - 1)} className="btn btn-secondary btn-sm" scroll={false}>← Anterior</Link>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled style={{ opacity: 0.45, pointerEvents: 'none' }}>← Anterior</span>
        )}
        {pageWindow(info.page, info.pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`gap${i}`} className="muted" aria-hidden>…</span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              scroll={false}
              className={p === info.page ? 'btn btn-sm' : 'btn btn-secondary btn-sm'}
              aria-current={p === info.page ? 'page' : undefined}
            >
              {p}
            </Link>
          ),
        )}
        {info.page < info.pageCount ? (
          <Link href={href(info.page + 1)} className="btn btn-secondary btn-sm" scroll={false}>Siguiente →</Link>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled style={{ opacity: 0.45, pointerEvents: 'none' }}>Siguiente →</span>
        )}
      </div>
    </nav>
  );
}
