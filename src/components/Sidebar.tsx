"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "@/app/actions/auth";

interface SidebarProps {
  role: "ADMIN" | "SUBADMIN";
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();

  const navLinks = [
    { name: "Dashboard", href: "/", icon: "📊" },
    { name: "Clientes", href: "/clientes", icon: "👥" },
    { name: "Pedidos", href: "/pedidos", icon: "🛒" },
    { name: "Cajas", href: "/cajas", icon: "📦" },
    { name: "Productos", href: "/productos", icon: "🏷️" },
    { name: "Contabilidad", href: "/gastos", icon: "📊" },
    ...(role === "ADMIN"
      ? [
          { name: "Configuraciones", href: "/configuraciones", icon: "⚙️" },
          { name: "Usuarios", href: "/usuarios", icon: "🔑" },
        ]
      : []),
  ];

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
        <div className="user-profile-mini" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <span className="user-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
            <span className="user-role">{role === "ADMIN" ? "Admin" : "Sub-admin"}</span>
          </div>
          <button
            onClick={() => signOut()}
            title="Cerrar sesión"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
