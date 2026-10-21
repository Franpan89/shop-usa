'use client';

import { useState } from 'react';
import Link from 'next/link';
import { confirmAuthLink } from '@/app/actions/auth';

export default function ConfirmButton({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const result = await confirmAuthLink(tokenHash, type);
      if (result?.error) setError(result.error);
    } catch (err: unknown) {
      // redirect() lanza internamente cuando sale bien: solo un error real llega aquí como fallo.
      const digest = (err as { digest?: string } | null)?.digest;
      if (digest?.startsWith('NEXT_REDIRECT')) throw err;
      setError('No se pudo continuar. Intenta de nuevo.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', color: 'var(--color-danger)', padding: '12px 16px', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {error} <Link href="/olvide-contrasena">Pedir un enlace nuevo</Link>
        </div>
      )}
      <button type="button" className="btn" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Verificando...' : 'Continuar'}
      </button>
    </div>
  );
}
