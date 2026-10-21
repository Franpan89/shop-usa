import type { Viewport } from 'next';
import { requirePortalClient } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';
import BrandLogo from '@/components/BrandLogo';
import Toaster from '@/components/ui/Toast';
import PortalNav from './PortalNav';

// El portal se usa sobre todo desde el celular: viewport explícito y sin zoom accidental al enfocar campos.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#104336' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await requirePortalClient();

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="logo-container" style={{ padding: 0 }}><BrandLogo height={30} /></div>
        <div className="portal-header-end">
          <PortalNav />
          <span className="portal-user muted small">{client.name}</span>
          <form action={signOut}>
            <button type="submit" className="btn btn-secondary btn-sm">Salir</button>
          </form>
        </div>
      </header>
      <main className="portal-body">{children}</main>
      <Toaster />
    </div>
  );
}
