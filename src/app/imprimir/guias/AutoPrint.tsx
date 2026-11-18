'use client';

import { useEffect } from 'react';

/** Con ?auto=1 abre el diálogo de impresión cuando las etiquetas (logo incluido) ya cargaron. */
export default function AutoPrint({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const notifyParent = () => {
      if (window.parent !== window) window.parent.postMessage('guides-printed', window.location.origin);
    };
    window.addEventListener('afterprint', notifyParent);

    (async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? null : new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); }),
        ),
      );
      if (!cancelled) window.print();
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', notifyParent);
    };
  }, [auto]);

  return null;
}

export function PrintNowButton() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      🖨️ Imprimir
    </button>
  );
}
