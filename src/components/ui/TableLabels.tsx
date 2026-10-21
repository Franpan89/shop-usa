'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * En celular las tablas se muestran como tarjetas (ver staff-responsive.css) y cada dato
 * necesita su rótulo. Esto copia el texto del encabezado de cada columna al atributo
 * data-label de las celdas, así ninguna tabla tiene que repetirlo a mano.
 * No renderiza nada y no toca el contenido: solo agrega atributos.
 */
function labelTable(table: HTMLTableElement) {
  const head = table.tHead?.rows[0];
  if (!head) return;
  const labels = Array.from(head.cells, (th) => th.textContent?.trim() ?? '');
  for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody > tr, tfoot > tr'))) {
    const cells = Array.from(row.cells);
    if (cells.some((c) => c.colSpan > 1)) continue; // filas "vacías" o de totales: sin rótulos
    cells.forEach((cell, i) => {
      const label = labels[i];
      if (label && cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
    });
  }
}

export default function TableLabels() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table.data-table').forEach(labelTable);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();
    // Las páginas cargan filas nuevas sin recargar (filtros, acciones del servidor).
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector('.main-content') ?? document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
