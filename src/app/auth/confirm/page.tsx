import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import ConfirmButton from './ConfirmButton';

export const dynamic = 'force-dynamic';

/** Destino de los enlaces de los correos de acceso. El token solo se canjea al pulsar el botón. */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = !!tokenHash && (type === 'invite' || type === 'recovery');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo height={42} />
        </div>
        {valid ? (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 12, color: 'var(--color-ink)' }}>
              {type === 'invite' ? 'Activa tu acceso' : 'Cambia tu contraseña'}
            </h1>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
              Pulsa continuar para elegir tu contraseña.
            </p>
            <ConfirmButton tokenHash={tokenHash} type={type} />
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 300, textAlign: 'center', marginBottom: 12, color: 'var(--color-ink)' }}>Enlace inválido</h1>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Este enlace no está completo. <Link href="/olvide-contrasena">Pide uno nuevo</Link> o <Link href="/login">vuelve al inicio</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
