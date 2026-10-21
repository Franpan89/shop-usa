import Link from 'next/link';
import LoginForm from './LoginForm';
import BrandLogo from '@/components/BrandLogo';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo height={42} />
        </div>
        <span className="eyebrow" style={{ textAlign: 'center' }}>Acceso a tu cuenta</span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 24, color: 'var(--color-ink)' }}>Bienvenido a ShopUSA</h1>
        <LoginForm />
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
          <Link href="/olvide-contrasena">Olvidé mi contraseña</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: '0.9rem' }}>
          ¿Eres cliente y es tu primera vez? <Link href="/registro">Solicita tu acceso</Link>
        </p>
      </div>
    </div>
  );
}
