import SetPasswordForm from './SetPasswordForm';
import BrandLogo from '@/components/BrandLogo';

export default function SetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: '16px' }}>
          <BrandLogo height={42} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Elige tu contraseña para continuar.
        </p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
