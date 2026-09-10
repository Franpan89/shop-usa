'use client';

import { useState } from 'react';
import { signIn } from '@/app/actions/auth';

export default function LoginForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn(formData);
      if (result?.error) setError(result.error);
    } catch (err: any) {
      // redirect() throws internally on success — only a real error lands here.
      if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="input-container">
        <label>Correo</label>
        <input name="email" type="email" className="input-field" required autoFocus />
      </div>
      <div className="input-container">
        <label>Contraseña</label>
        <input name="password" type="password" className="input-field" required />
      </div>
      <button type="submit" className="btn" disabled={isPending} style={{ marginTop: '8px' }}>
        {isPending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}
