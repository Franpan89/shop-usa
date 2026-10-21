import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import RegistroForm from './RegistroForm';

export default function RegistroPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo height={42} />
        </div>
        <span className="eyebrow" style={{ textAlign: 'center' }}>Primera vez en el portal</span>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 12, color: 'var(--color-ink)' }}>Solicita tu acceso</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
          Usa tu código de cliente y el correo con el que quieres entrar. Revisamos tu solicitud y te enviamos un enlace para crear tu contraseña.
        </p>
        <RegistroForm />
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
          ¿Ya tienes acceso? <Link href="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
