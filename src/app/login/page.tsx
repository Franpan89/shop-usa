import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '380px' }}>
        <div className="logo-container" style={{ justifyContent: 'center', marginBottom: '32px' }}>
          <span className="logo-gradient">ShopUSA</span>
          <span>SaaS</span>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
