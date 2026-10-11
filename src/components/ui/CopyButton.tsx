'use client';

import { toast } from './Toast';

export default function CopyButton({ text, children = '📋 Copiar resumen', className = 'btn btn-secondary btn-sm' }: { text: string; children?: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Copiado al portapapeles', 'success');
        } catch {
          toast('No se pudo copiar', 'error');
        }
      }}
    >
      {children}
    </button>
  );
}
