'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/app/actions/access';

export default function ResetForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const result = await requestPasswordReset(new FormData(event.currentTarget));
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch {
      setError('No se pudo enviar. Intenta de nuevo.');
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <div className="alert alert-success" role="status">
        <span>✅</span>
        <div className="grow">Si ese correo tiene una cuenta, te enviamos un enlace para cambiar tu contraseña. Revisa también el spam.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: 'var(--color-danger)', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="input-container">
        <label>Correo</label>
        <input name="email" type="email" className="input-field" required autoFocus maxLength={254} autoComplete="email" />
      </div>
      <button type="submit" className="btn" disabled={isPending} style={{ marginTop: '8px' }}>
        {isPending ? 'Enviando...' : 'Enviar enlace'}
      </button>
    </form>
  );
}
