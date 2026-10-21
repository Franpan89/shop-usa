'use client';

import { useRef, useState } from 'react';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { requestUpload } from '@/app/actions/uploads';
import { toast } from './Toast';

interface ImageUploaderProps {
  kind: 'product' | 'proof';
  /** Valor actual: URL pública (producto) o ruta en Storage (comprobante). */
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  required?: boolean;
  /** Permite también PDF (comprobantes). */
  allowPdf?: boolean;
  compact?: boolean;
}

/** Reduce fotos de celular (varios MB) a un JPEG liviano antes de subirlas. */
async function compress(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (file.type === 'application/pdf') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
}

export default function ImageUploader({ kind, value, onChange, label, required, allowPdf, compact }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const preview = localPreview ?? (kind === 'product' ? value ?? null : null);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const blob = await compress(file);
      const isPdf = blob.type === 'application/pdf';
      const target = await requestUpload(kind, isPdf ? 'pdf' : 'jpg');
      if (!target.ok) throw new Error(target.error);

      const supabase = createBrowserSupabase();
      const { error } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, blob, { contentType: isPdf ? 'application/pdf' : 'image/jpeg' });
      if (error) throw new Error(error.message);

      setLocalPreview(isPdf ? null : URL.createObjectURL(blob));
      onChange(kind === 'product' ? target.publicUrl : target.path);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo subir el archivo', 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  const hasValue = !!value;

  return (
    <div className="stack-sm">
      {label && (
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      <div className="row" style={{ gap: 10 }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className={compact ? 'thumb' : 'thumb thumb-lg'} />
        ) : (
          <span className={compact ? 'thumb' : 'thumb thumb-lg'} aria-hidden>
            {hasValue ? '📎' : '📷'}
          </span>
        )}
        {/* Galería / archivos: sin `capture`, el celular deja elegir entre fotos existentes o la cámara */}
        <input
          ref={inputRef}
          type="file"
          accept={allowPdf ? 'image/*,application/pdf' : 'image/*'}
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {/* Cámara directa (solo fotos de producto) */}
        {!allowPdf && (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        )}
        {busy ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled>⏳ Subiendo…</button>
        ) : allowPdf ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
            {hasValue ? 'Cambiar' : '📎 Subir comprobante'}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => cameraRef.current?.click()}>
              📷 {hasValue ? 'Otra foto' : 'Cámara'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
              🖼️ Galería
            </button>
          </>
        )}
        {hasValue && !busy && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setLocalPreview(null);
              onChange(null);
            }}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
