import Link from 'next/link';
import { requirePortalClient } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';
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
      <header className="portal-header">
        <div className="logo-container" style={{ padding: 0 }}><BrandLogo height={30} /></div>
        <nav className="portal-nav" aria-label="Portal del cliente">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="portal-link">{n.label}</Link>
          ))}
          <span className="muted small" style={{ margin: '0 8px' }}>{client.name}</span>
          <form action={signOut}>
            <button type="submit" className="btn btn-secondary btn-sm">Salir</button>
          </form>
        </nav>
      </header>
      <main className="portal-body">{children}</main>
      <Toaster />
    </div>
  );
}
