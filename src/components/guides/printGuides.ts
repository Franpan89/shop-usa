'use client';

import { registerGuidePrints } from '@/app/actions/guides';

/** Máximo de guías por trabajo de impresión (la lista viaja en la URL). */
export const MAX_PRINT_BATCH = 150;

/**
 * Imprime guías sin salir de la pantalla: carga las etiquetas en un iframe oculto y abre
 * el diálogo de impresión del navegador (4x6 in, una etiqueta por página). Un iframe no
 * lo bloquea el bloqueador de ventanas emergentes, a diferencia de window.open tras una acción async.
 */
export function printGuides(ids: string[]): void {
  if (typeof document === 'undefined' || ids.length === 0) return;
  const batch = ids.slice(0, MAX_PRINT_BATCH);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  iframe.src = `/imprimir/guias?ids=${encodeURIComponent(batch.join(','))}&auto=1`;

  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    window.clearTimeout(timer);
    iframe.remove();
  };
  const onMessage = (e: MessageEvent) => {
    if (e.origin === window.location.origin && e.data === 'guides-printed') cleanup();
  };
  const timer = window.setTimeout(cleanup, 5 * 60_000);
  window.addEventListener('message', onMessage);
  document.body.appendChild(iframe);

  void registerGuidePrints(batch);
}
