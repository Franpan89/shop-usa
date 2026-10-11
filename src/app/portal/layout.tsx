import Link from 'next/link';
import { requirePortalClient } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';
import BgBlobs from '@/components/BgBlobs';
import BrandLogo from '@/components/BrandLogo';
import Toaster from '@/components/ui/Toast';

const NAV = [
  { href: '/portal', label: 'Mi mercancía' },
  { href: '/portal/pedidos', label: 'Mis pedidos' },
  { href: '/portal/estado-de-cuenta', label: 'Estado de cuenta' },
  { href: '/portal/perfil', label: 'Mi perfil' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await requirePortalClient();

  return (
    <div className="portal-shell">
      <BgBlobs />
      <header className="portal-header">
        <div className="logo-container"><BrandLogo height={30} /></div>
        <nav className="portal-nav" aria-label="Portal del cliente">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="portal-link">{n.label}</Link>
          ))}
          <span className="muted small">{client.name}</span>
          <form action={signOut}>
            <button type="submit" title="Cerrar sesión" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🚪</button>
          </form>
        </nav>
      </header>
      <div className="glass-container" style={{ padding: 0, height: 'auto', overflow: 'visible' }}>
        {children}
      </div>
      <Toaster />
    </div>
  );
}
