"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import BrandLogo from "./BrandLogo";
import { signOut } from "@/app/actions/auth";
import type { NavCounts } from "@/lib/navCounts";

interface SidebarProps {
  role: "ADMIN" | "SUBADMIN";
  userName: string;
  counts?: NavCounts;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  count?: keyof NavCounts;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

export default function Sidebar({ role, userName, counts = {} }: SidebarProps) {
  const pathname = usePathname();

  // El orden del menú sigue el recorrido de la mercancía: vender → cobrar → comprar → recibir → enviar → entregar.
  const groups: NavGroup[] = [
    { items: [{ name: "Dashboard", href: "/dashboard", icon: "📊" }] },
    {
      title: "Ventas",
      items: [
        { name: "Clientes", href: "/clientes", icon: "👥" },
        { name: "Pedidos", href: "/pedidos", icon: "🛒" },
        { name: "Pagos", href: "/pagos", icon: "💳", count: "pagos" },
      ],
    },
    {
      title: "Compras y bodega",
      items: [
        { name: "Compras", href: "/compras", icon: "🛍️", count: "compras" },
        { name: "Recepción", href: "/recepcion", icon: "📥", count: "recepcion" },
        { name: "Consolidados", href: "/consolidados", icon: "🧺", count: "consolidados" },
      ],
    },
    {
      title: "Logística",
      items: [
        { name: "Cajas (PKG)", href: "/cajas", icon: "📦", count: "cajas" },
        { name: "Despachos", href: "/despachos", icon: "🚚" },
        { name: "Desconsolidación", href: "/desconsolidacion", icon: "🗂️", count: "desconsolidacion" },
        { name: "Entregas", href: "/entregas", icon: "🤝", count: "entregas" },
      ],
    },
    {
      title: "Servicios",
      items: [{ name: "Custodio", href: "/custodio", icon: "🏠", count: "custodio" }],
    },
    {
      title: "Administración",
      items: [
        { name: "Contabilidad", href: "/gastos", icon: "🧾" },
        { name: "Catálogo", href: "/productos", icon: "🏷️" },
        ...(role === "ADMIN"
          ? [
              { name: "Configuraciones", href: "/configuraciones", icon: "⚙️" },
              { name: "Usuarios", href: "/usuarios", icon: "🔑" },
            ]
          : []),
      ],
    },
  ];

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sidebar glass-panel static" style={{ height: 'calc(100vh - 48px)', margin: '24px 0 24px 24px' }}>
      <Link href="/dashboard" className="logo-container">
        <BrandLogo height={30} />
      </Link>

      <nav className="nav-menu" aria-label="Navegación principal">
        {groups.map((group, gi) => (
          <div key={gi} style={{ display: 'contents' }}>
            {group.title && <div className="nav-section">{group.title}</div>}
            {group.items.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              const count = link.count ? counts[link.count] ?? 0 : 0;
              return (
                <Link key={link.href} href={link.href} className={`nav-link ${isActive ? "active" : ""}`}>
                  <span style={{ fontSize: '1.05rem', width: 22, textAlign: 'center' }}>{link.icon}</span>
                  {link.name}
                  {count > 0 && <span className="nav-badge">{count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
