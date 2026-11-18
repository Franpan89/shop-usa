'use client';

import { useState } from 'react';
import { demoSignIn } from '@/app/actions/auth';
import { DEMO_ACCOUNTS, type DemoRole } from '@/lib/demo';

/** Entrada de un clic a las cuentas ficticias del demo (solo se muestra con DEMO_MODE=true). */
export default function DemoAccess() {
  const [pending, setPending] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(role: DemoRole) {
    setPending(role);
    setError(null);
    try {
      const result = await demoSignIn(role);
      if (result?.error) setError(result.error);
    } catch (err: unknown) {
      const digest = (err as { digest?: string } | null)?.digest;
      if (digest?.startsWith('NEXT_REDIRECT')) throw err;
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div className="alert alert-danger" style={{ padding: '10px 14px' }}>⚠️ {error}</div>}
      {(Object.keys(DEMO_ACCOUNTS) as DemoRole[]).map((role) => (
        <button
          key={role}
          type="button"
          className={role === 'admin' ? 'btn' : 'btn btn-secondary'}
          disabled={pending !== null}
          onClick={() => enter(role)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', padding: '12px 16px' }}
        >
          <strong>{pending === role ? 'Entrando…' : `Entrar como ${DEMO_ACCOUNTS[role].label}`}</strong>
          <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>{DEMO_ACCOUNTS[role].hint}</span>
        </button>
      ))}
      <p className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>
        Datos ficticios · el demo se restablece cada día
      </p>
    </div>
  );
}
