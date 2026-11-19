/** Paginación de listas largas (sin base de datos ni Next: se prueba con `npm test`). */

export const PAGE_SIZE = 10;

export interface PageInfo {
  /** Página mostrada, entre 1 y pageCount. */
  page: number;
  pageCount: number;
  total: number;
  size: number;
  /** Índices para `slice(start, end)`. */
  start: number;
  end: number;
}

/** Una página fuera de rango (o que no es un número) se ajusta a la más cercana. */
export function pageInfo(total: number, requested: unknown, size = PAGE_SIZE): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const n = Math.floor(Number(requested));
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), pageCount) : 1;
  const start = (page - 1) * size;
  return { page, pageCount, total, size, start, end: Math.min(start + size, total) };
}

/** Números a mostrar en el paginador: siempre la primera y la última, y las vecinas de la actual. */
export function pageWindow(page: number, pageCount: number, around = 1): (number | '…')[] {
  const wanted = new Set<number>([1, pageCount]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pageCount) wanted.add(p);
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}
