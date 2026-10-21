'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/portal', label: 'Mercancía', long: 'Mi mercancía', icon: '📦' },
  { href: '/portal/pedidos', label: 'Pedidos', long: 'Mis pedidos', icon: '🛒' },
  { href: '/portal/estado-de-cuenta', label: 'Cuenta', long: 'Estado de cuenta', icon: '💳' },
  { href: '/portal/perfil', label: 'Perfil', long: 'Mi perfil', icon: '👤' },
];

/** /portal solo es "activo" en su propia página; el resto, también en sus subpáginas. */
const isActive = (pathname: string, href: string) => (href === '/portal' ? pathname === '/portal' : pathname.startsWith(href));

/** Menú del portal: enlaces arriba en pantallas grandes y barra fija abajo en el celular (alcanzable con el pulgar). */
export default function PortalNav() {
  const pathname = usePathname();
  return (
    <>
      <nav className="portal-links" aria-label="Portal del cliente">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`portal-link${isActive(pathname, n.href) ? ' active' : ''}`} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
            {n.long}
          </Link>
        ))}
      </nav>
      <nav className="portal-tabbar" aria-label="Menú del portal">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`tab${isActive(pathname, n.href) ? ' active' : ''}`} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
