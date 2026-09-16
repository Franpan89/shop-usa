"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Navbar.module.css";
import BrandLogo from "@/components/BrandLogo";

const NAV_LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas", label: "Preguntas" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
        <Link href="/" className={styles.brand}>
          <BrandLogo height={32} />
        </Link>

        <nav className={styles.links}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </a>
          ))}
          <Link href="/login" className={styles.portalLink}>
            Portal de clientes
          </Link>
          <a href="#contacto" className={styles.cta}>
            Empieza ahora
          </a>
        </nav>

        <button
          className={styles.menuBtn}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            {open ? (
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>

      {open && (
        <div className={styles.mobilePanel}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Portal de clientes
          </Link>
          <a href="#contacto" onClick={() => setOpen(false)}>
            Empieza ahora →
          </a>
        </div>
      )}
    </>
  );
}
