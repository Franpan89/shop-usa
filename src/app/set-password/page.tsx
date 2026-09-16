import SetPasswordForm from './SetPasswordForm';
import BrandLogo from '@/components/BrandLogo';

export default function SetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '380px' }}>
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
