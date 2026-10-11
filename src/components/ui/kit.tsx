import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BadgeTone, StatusMeta } from '@/lib/domain/flow';

/** Piezas de presentación compartidas (componentes de servidor, sin estado). */

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  badges,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="grow">
        {back && (
          <Link href={back.href} className="back-link">
            ← {back.label}
          </Link>
        )}
        <div className="row" style={{ gap: 14 }}>
          <h1 className="page-title">{title}</h1>
          {badges}
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function StatusBadge({ meta, small }: { meta: StatusMeta; small?: boolean }) {
  return <span className={`badge badge-${meta.tone}${small ? ' badge-sm' : ''}`}>{meta.label}</span>;
}

export function ToneBadge({ tone, children, small }: { tone: BadgeTone; children: ReactNode; small?: boolean }) {
  return <span className={`badge badge-${tone}${small ? ' badge-sm' : ''}`}>{children}</span>;
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'danger' | 'success' | 'warning' | 'accent';
  href?: string;
}) {
  const className = `glass-panel kpi${tone ? ` tone-${tone}` : ''}`;
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="kpi-grid">{children}</div>;
}

export function Alert({ tone = 'info', children }: { tone?: 'danger' | 'warning' | 'success' | 'info'; children: ReactNode }) {
  const icon = { danger: '⛔', warning: '⚠️', success: '✅', info: 'ℹ️' }[tone];
  return (
    <div className={`alert alert-${tone}`} role="alert">
      <span>{icon}</span>
      <div className="grow">{children}</div>
    </div>
  );
}

export function Empty({ icon = '📭', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <div className="title">{title}</div>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Tabs({
  items,
}: {
  items: { href: string; label: string; count?: number; active: boolean }[];
}) {
  return (
    <nav className="tabs" aria-label="Secciones">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`tab${t.active ? ' active' : ''}`}>
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="tab-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Stepper({ steps, current }: { steps: { label: string }[]; current: number }) {
  return (
    <div className="stepper" aria-label="Progreso">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : '';
        return (
          <div key={s.label} className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
            <div className={`step ${state}`}>
              <span className="step-dot">{i < current ? '✓' : i + 1}</span>
              {s.label}
            </div>
            {i < steps.length - 1 && <span className={`step-line ${i < current ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

/** 🔴 NO ENTREGAR / 🟢 AUTORIZADO (7.11 / 7.12) */
export function AuthPill({ ok, okLabel, noLabel }: { ok: boolean; okLabel: string; noLabel: string }) {
  return <span className={`auth-pill ${ok ? 'ok' : 'no'}`}>{ok ? `🟢 ${okLabel}` : `🔴 ${noLabel}`}</span>;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`glass-panel static${flush ? '' : ' panel'}`} style={flush ? { padding: 0, overflow: 'hidden' } : undefined}>
      {(title || actions) && (
        <div className="panel-head" style={flush ? { padding: '20px 24px 0' } : undefined}>
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const shortDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const longDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export function qty(name: string, quantity: number) {
  return quantity > 1 ? `${name} (x${quantity})` : name;
}
