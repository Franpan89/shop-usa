'use client';

import { useRef, useState } from 'react';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { requestUpload } from '@/app/actions/uploads';
import { compress } from './ImageUploader';
import { toast } from './Toast';

export interface ReceiptFile {
  /** Ruta en el bucket privado de recibos (lo que se guarda en el gasto). */
  path: string;
  /** URL para mostrarlo: firmada (ya guardado) o local (recién subido). */
  url: string | null;
  isPdf: boolean;
}

interface Props {
  value: ReceiptFile[];
  /** Recibe un actualizador, porque varias fotos se suben una tras otra. */
  onChange: (update: (prev: ReceiptFile[]) => ReceiptFile[]) => void;
  max?: number;
}

/** Varias fotos (o PDF) de un mismo recibo: los recibos largos no caben en una sola foto. */
export default function ReceiptUploader({ value, onChange, max = 12 }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadOne(file: File): Promise<ReceiptFile> {
    const blob = await compress(file);
    const isPdf = blob.type === 'application/pdf';
    const target = await requestUpload('receipt', isPdf ? 'pdf' : 'jpg');
    if (!target.ok) throw new Error(target.error);
    const { error } = await createBrowserSupabase()
      .storage.from(target.bucket)
      .uploadToSignedUrl(target.path, target.token, blob, { contentType: isPdf ? 'application/pdf' : 'image/jpeg' });
    if (error) throw new Error(error.message);
    return { path: target.path, url: isPdf ? null : URL.createObjectURL(blob), isPdf };
  }

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    if (files.length === 0) return;

    const room = max - value.length;
    if (room <= 0) return toast(`Máximo ${max} fotos por gasto`, 'error');
    const batch = files.slice(0, room);
    if (batch.length < files.length) toast(`Solo caben ${max} fotos: se subirán las primeras ${batch.length}`, 'error');

    setProgress({ done: 0, total: batch.length });
    let failed = 0;
    for (const [i, file] of batch.entries()) {
      try {
        const uploaded = await uploadOne(file);
        onChange((prev) => [...prev, uploaded]);
      } catch (err) {
        failed++;
        toast(err instanceof Error ? err.message : 'No se pudo subir una foto', 'error');
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    setProgress(null);
    if (failed > 0 && failed < batch.length) toast(`${failed} foto(s) no se subieron. Revisa y vuelve a intentarlo.`, 'error');
  }

  const busy = progress !== null;

  return (
    <div className="stack-sm">
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
        Fotos del recibo <span className="muted">(puedes subir varias)</span>
      </label>

      {value.length > 0 && (
        <div className="row" style={{ gap: 10 }}>
          {value.map((f, i) => (
            <div key={f.path} style={{ position: 'relative' }}>
              {f.url && !f.isPdf ? (
                <a href={f.url} target="_blank" rel="noreferrer" title={`Ver foto ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Recibo ${i + 1}`} className="thumb thumb-lg" />
                </a>
              ) : (
                <span className="thumb thumb-lg" aria-hidden>📎</span>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Quitar esta foto"
                disabled={busy}
                style={{ position: 'absolute', top: -8, right: -8, padding: '0 6px', minHeight: 0, lineHeight: '20px', background: 'var(--surface, #fff)', borderRadius: 999 }}
                onClick={() => onChange((prev) => prev.filter((x) => x.path !== f.path))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={galleryRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFiles(e.target.files)} />

      <div className="row" style={{ gap: 8 }}>
        {busy ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled>⏳ Subiendo {progress.done + 1 > progress.total ? progress.total : progress.done + 1} de {progress.total}…</button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => cameraRef.current?.click()}>
              📷 {value.length > 0 ? 'Otra foto' : 'Cámara'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => galleryRef.current?.click()}>
              🖼️ Galería / archivos
            </button>
          </>
        )}
        {value.length > 0 && <span className="muted small">{value.length} de {max}</span>}
      </div>
    </div>
  );
}
