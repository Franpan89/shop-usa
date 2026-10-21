'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Ícono ⓘ con explicación. Funciona con mouse (hover), teclado (foco) y táctil (un toque abre,
 * otro toque fuera o la tecla Esc cierra), que es lo que importa en el celular.
 */
export default function InfoTip({ children, label = 'Más información' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // El navegador táctil simula un "mouseenter" antes del clic: si lo escucháramos, tocar abriría y cerraría al instante.
  const isMouse = (e: React.PointerEvent) => e.pointerType === 'mouse';

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref} onPointerEnter={(e) => isMouse(e) && setOpen(true)} onPointerLeave={(e) => isMouse(e) && setOpen(false)}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={label}
        aria-expanded={open}
        onPointerUp={(e) => {
          // Con mouse manda el hover; con el dedo (o lápiz) un toque abre y otro cierra.
          if (!isMouse(e)) setOpen((v) => !v);
        }}
        onClick={(e) => e.preventDefault()} // dentro de un <Link> no debe navegar
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="infotip-pop">
          {children}
        </span>
      )}
    </span>
  );
}
