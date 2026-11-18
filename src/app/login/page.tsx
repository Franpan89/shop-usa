import Link from 'next/link';
import LoginForm from './LoginForm';
import DemoAccess from './DemoAccess';
import BrandLogo from '@/components/BrandLogo';
import { SITE } from '@/config/site';
import { isDemo } from '@/lib/demo';

export default function LoginPage() {
  const demo = isDemo();
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo height={42} />
        </div>
        <span className="eyebrow" style={{ textAlign: 'center' }}>{demo ? 'Demostración del sistema' : 'Acceso a tu cuenta'}</span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 24, color: 'var(--color-ink)' }}>
          {demo ? 'Explora el sistema' : `Bienvenido a ${SITE.brand}`}
        </h1>
        {demo ? (
          <DemoAccess />
        ) : (
          <>
            <LoginForm />
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
              <Link href="/olvide-contrasena">Olvidé mi contraseña</Link>
            </p>
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: '0.9rem' }}>
              ¿Eres cliente y es tu primera vez? <Link href="/registro">Solicita tu acceso</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
