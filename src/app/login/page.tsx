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
      </div>
    </div>
  );
}
