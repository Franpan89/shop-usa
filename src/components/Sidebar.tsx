"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
        { name: "Accesos", href: "/accesos", icon: "🎟️", count: "accesos" },
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

  // Celular: el menú es un panel que se desliza; se cierra al navegar, con Esc o tocando fuera.
  // Se guarda la ruta en la que se abrió: al navegar deja de coincidir y el panel se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    document.body.classList.add("nav-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  const activeItem = groups.flatMap((g) => g.items).find((l) => pathname === l.href || pathname.startsWith(l.href + "/"));
  const totalPending = Object.values(counts).reduce<number>((s, n) => s + (n ?? 0), 0);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Atajos del menú inferior (celular): lo que más se usa a diario.
  const tabs: { name: string; href: string; icon: string; count?: keyof NavCounts }[] = [
    { name: "Inicio", href: "/dashboard", icon: "📊" },
    { name: "Pedidos", href: "/pedidos", icon: "🛒" },
    { name: "Pagos", href: "/pagos", icon: "💳", count: "pagos" },
    { name: "Recepción", href: "/recepcion", icon: "📥", count: "recepcion" },
  ];

  return (
    <>
      {/* Barra superior: solo se ve en celular y tablet */}
      <header className="mobile-topbar no-print">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>☰</span>
          {totalPending > 0 && <span className="mobile-menu-dot" aria-hidden />}
        </button>
        <div className="mobile-topbar-title">
          {activeItem ? (
            <>
              <span aria-hidden>{activeItem.icon}</span> {activeItem.name}
            </>
          ) : (
            <BrandLogo height={24} />
          )}
        </div>
        <div className="user-avatar" aria-hidden>{initials}</div>
      </header>

      <div className={`sidebar-backdrop no-print${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden />

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-head">
          <Link href="/dashboard" className="logo-container">
            <BrandLogo height={30} />
          </Link>
          <button type="button" className="sidebar-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <nav className="nav-menu" aria-label="Navegación principal">
          {groups.map((group, gi) => (
            <div key={gi} style={{ display: 'contents' }}>
              {group.title && <div className="nav-section">{group.title}</div>}
              {group.items.map((link) => {
                const count = link.count ? counts[link.count] ?? 0 : 0;
                return (
                  <Link key={link.href} href={link.href} className={`nav-link ${isActive(link.href) ? "active" : ""}`}>
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
          <div className="user-profile-mini" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
              <span className="user-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
              <span className="user-role">{role === "ADMIN" ? "Admin" : "Sub-admin"}</span>
            </div>
            <button
              onClick={() => signOut()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Menú inferior al alcance del pulgar: solo celular */}
      <nav className="staff-tabbar no-print" aria-label="Accesos rápidos">
        {tabs.map((t) => {
          const count = t.count ? counts[t.count] ?? 0 : 0;
          return (
            <Link key={t.href} href={t.href} className={`tab${isActive(t.href) ? " active" : ""}`}>
              <span className="tab-icon" aria-hidden>
                {t.icon}
                {count > 0 && <span className="tab-dot">{count > 99 ? "99+" : count}</span>}
              </span>
              {t.name}
            </Link>
          );
        })}
        <button type="button" className="tab" onClick={() => setOpen(true)}>
          <span className="tab-icon" aria-hidden>☰</span>
          Más
        </button>
      </nav>
    </>
  );
}
