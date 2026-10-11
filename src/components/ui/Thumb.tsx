'use client';

import { useState } from 'react';

/** Miniatura de producto; al tocarla se ve en grande. */
export default function Thumb({ src, alt, large }: { src?: string | null; alt: string; large?: boolean }) {
  const [open, setOpen] = useState(false);
  const cls = large ? 'thumb thumb-lg' : 'thumb';

  if (!src) {
    return (
      <span className={cls} title="Sin foto" style={{ cursor: 'default', opacity: 0.6 }}>
        🖼️
      </span>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={cls} loading="lazy" onClick={() => setOpen(true)} />
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} />
        </div>
      )}
    </>
  );
}
