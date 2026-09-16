import Link from 'next/link';
import { requirePortalClient } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';
import BgBlobs from '@/components/BgBlobs';
import BrandLogo from '@/components/BrandLogo';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await requirePortalClient();

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      <BgBlobs />
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div className="logo-container">
          <BrandLogo height={30} />
        </div>
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link href="/portal" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>Mis Pedidos</Link>
          <Link href="/portal/estado-de-cuenta" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>Estado de Cuenta</Link>
          <Link href="/portal/perfil" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>Mi Perfil</Link>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{client.name}</span>
          <form action={signOut}>
            <button type="submit" title="Cerrar sesión" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🚪</button>
          </form>
        </nav>
      </header>
      <div className="glass-container" style={{ padding: 0 }}>
        {children}
      </div>
    </div>
  );
}
