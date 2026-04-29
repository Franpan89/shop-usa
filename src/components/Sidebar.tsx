"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Dashboard", href: "/", icon: "📊" },
    { name: "Clientes", href: "/clientes", icon: "👥" },
    { name: "Pedidos", href: "/pedidos", icon: "🛒" },
    { name: "Cajas", href: "/cajas", icon: "📦" },
    { name: "Contabilidad", href: "/gastos", icon: "📊" },
    { name: "Configuraciones", href: "/configuraciones", icon: "⚙️" },
  ];

  return (
    <aside className="sidebar glass-panel" style={{ height: 'calc(100vh - 48px)', margin: '24px 0 24px 24px' }}>
      <Link href="/" className="logo-container">
        <span className="logo-gradient">ShopUSA</span>
        <span>SaaS</span>
      </Link>

      <nav className="nav-menu mt-8">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              <span style={{ fontSize: '1.1rem' }}>{link.icon}</span>
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ThemeToggle />
        <div className="user-profile-mini">
          <div className="user-avatar">AD</div>
          <div className="user-info">
            <span className="user-name">Administrador</span>
            <span className="user-role">Super Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
