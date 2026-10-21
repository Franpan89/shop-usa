import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import ResetForm from './ResetForm';

export default function OlvideContrasenaPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo height={42} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 12, color: 'var(--color-ink)' }}>Recupera tu contraseña</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
          Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva.
        </p>
        <ResetForm />
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
