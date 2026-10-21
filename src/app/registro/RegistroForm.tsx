'use client';

import { useState } from 'react';
import { requestPortalAccess } from '@/app/actions/access';

export default function RegistroForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const result = await requestPortalAccess(new FormData(event.currentTarget));
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <div className="alert alert-success" role="status">
        <span>✅</span>
        <div className="grow">
          <strong>Recibimos tu solicitud.</strong> La revisamos y, cuando esté aprobada, te llegará un correo para crear tu contraseña. Si no lo ves, revisa la carpeta de spam.
        </div>
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
        <label>Código de cliente</label>
        <input name="code" className="input-field" placeholder="EC001" required autoFocus autoCapitalize="characters" autoComplete="off" maxLength={14} />
      </div>
      <div className="input-container">
        <label>Teléfono registrado en Shop USA</label>
        <input name="phone" type="tel" className="input-field" placeholder="+593 99 123 4567" required maxLength={40} autoComplete="tel" />
      </div>
      <div className="input-container">
        <label>Correo con el que quieres entrar</label>
        <input name="email" type="email" className="input-field" required maxLength={254} autoComplete="email" />
      </div>
      <button type="submit" className="btn" disabled={isPending} style={{ marginTop: '8px' }}>
        {isPending ? 'Enviando...' : 'Solicitar acceso'}
      </button>
    </form>
  );
}
