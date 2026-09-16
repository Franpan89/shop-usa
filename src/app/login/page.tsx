import LoginForm from './LoginForm';
import BgBlobs from '@/components/BgBlobs';
import BrandLogo from '@/components/BrandLogo';

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <BgBlobs />
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '380px' }}>
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: '32px' }}>
          <BrandLogo height={42} />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
