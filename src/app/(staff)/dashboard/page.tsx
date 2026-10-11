import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings, getTenantId } from '@/lib/tenant';
import { retentionDays, retentionLevel } from '@/lib/domain/flow';
import { Kpi, KpiGrid, Panel, ToneBadge, longDateTime, money } from '@/components/ui/kit';

import { nowMs } from '@/lib/clock';

export const dynamic = 'force-dynamic';

interface Step {
  href: string;
  icon: string;
  label: string;
  count: number;
  hint: string;
  tone?: 'warning' | 'danger' | 'success' | 'accent';
}

/** El tablero sigue el recorrido de la mercancía: cada paso muestra cuánto está esperando acción. */
export default async function DashboardPage() {
  const user = await requireStaff();
  const tenantId = await getTenantId();
  const settings = await getSettings();

  const [pendingPay, toVerify, ready, toReceive, openCons, held, pool, pkgsPrep, draftDispatch, transit, pickup, custody, invoices, payments] = await Promise.all([
    prisma.order.count({ where: { tenantId, status: 'PENDING_PAYMENT' } }),
    prisma.payment.count({ where: { tenantId, status: 'PENDING_VERIFICATION' } }),
    prisma.product.count({ where: { tenantId, status: 'READY_TO_BUY' } }),
    prisma.product.count({ where: { tenantId, status: 'PURCHASED' } }),
    prisma.consolidation.count({ where: { tenantId, status: 'OPEN', decision: 'DISPATCH', products: { some: { status: 'RECEIVED' } } } }),
    prisma.consolidation.findMany({ where: { tenantId, status: 'OPEN', decision: 'HOLD' }, select: { retentionStartedAt: true } }),
    prisma.product.count({ where: { tenantId, status: 'RECEIVED', pkgId: null, consolidation: { status: 'CLOSED' } } }),
    prisma.pkg.count({ where: { tenantId, status: 'IN_PREPARATION' } }),
    prisma.dispatch.count({ where: { tenantId, status: 'DRAFT' } }),
    prisma.pkg.count({ where: { tenantId, status: { in: ['IN_TRANSIT', 'AT_DESTINATION'] } } }),
    prisma.product.count({ where: { tenantId, status: 'READY_FOR_PICKUP' } }),
    prisma.custodyPackage.count({ where: { tenantId, status: 'IN_CUSTODY' } }),
    prisma.invoice.findMany({ where: { tenantId, status: { in: ['PENDING', 'PARTIAL'] } }, select: { total: true, paidAmount: true } }),
    prisma.payment.aggregate({ where: { tenantId, status: 'APPROVED', kind: 'PAYMENT', paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } }),
  ]);

  const warnings = held.filter((h) => {
    const level = retentionLevel(retentionDays(h.retentionStartedAt), true, settings.retentionWarningDays, settings.retentionMaxDays);
    return level === 'warning' || level === 'overdue';
  }).length;
  const receivable = invoices.reduce((s, i) => s + (i.total - i.paidAmount), 0);
  const cutoff = settings.dispatchCutoffAt;

  const steps: { title: string; items: Step[] }[] = [
    {
      title: '1 · Vender y cobrar',
      items: [
        { href: '/pedidos?estado=pago', icon: '🛒', label: 'Pedidos pendientes de pago', count: pendingPay, hint: 'No se compra sin pago' },
        { href: '/pagos', icon: '💳', label: 'Comprobantes por verificar', count: toVerify, hint: 'Confirma que el dinero llegó', tone: toVerify ? 'warning' : undefined },
      ],
    },
    {
      title: '2 · Comprar y recibir',
      items: [
        { href: '/compras', icon: '🛍️', label: 'Listos para comprar', count: ready, hint: 'Pago aprobado', tone: ready ? 'accent' : undefined },
        { href: '/recepcion', icon: '📥', label: 'Comprados, por recibir', count: toReceive, hint: 'Esperando llegada a bodega' },
      ],
    },
    {
      title: '3 · Consolidar y cerrar',
      items: [
        { href: '/consolidados', icon: '🧺', label: 'Consolidados abiertos', count: openCons, hint: 'Se despachan si no piden retener' },
        { href: '/consolidados?vista=retenidos', icon: '⏳', label: 'Retenidos', count: held.length, hint: warnings ? `${warnings} con retención prolongada` : 'Sin alertas', tone: warnings ? 'warning' : undefined },
      ],
    },
    {
      title: '4 · Armar y enviar',
      items: [
        { href: '/cajas', icon: '📦', label: 'Productos sin PKG', count: pool, hint: `${pkgsPrep} PKG en preparación`, tone: pool ? 'accent' : undefined },
        { href: '/despachos', icon: '🚚', label: 'Despachos en borrador', count: draftDispatch, hint: 'Pendientes de confirmar salida' },
      ],
    },
    {
      title: '5 · Destino y entrega',
      items: [
        { href: '/desconsolidacion', icon: '🗂️', label: 'PKG en tránsito', count: transit, hint: 'Por desconsolidar al llegar' },
        { href: '/entregas', icon: '🤝', label: 'Listos para retirar', count: pickup, hint: 'Revisa el semáforo de saldo', tone: pickup ? 'success' : undefined },
      ],
    },
  ];

  return (
    <>
      <section className="hero-wash">
        <span className="eyebrow">Resumen operativo</span>
        <h1 className="display">Hola, {user.name}</h1>
        <p className="lead">Lo que está esperando acción en cada paso del recorrido de la mercancía.</p>
      </section>

      <KpiGrid>
        <Kpi label="Por cobrar" value={money(receivable)} tone={receivable > 0 ? 'danger' : 'success'} hint={`${invoices.length} factura(s) con saldo`} href="/pagos?vista=cobrar" />
        <Kpi label="Cobrado este mes" value={money(payments._sum.amount ?? 0)} tone="success" hint="Pagos aprobados" />
        <Kpi label="Custodio en Orlando" value={custody} hint="Paquetes en custodia" href="/custodio" />
        <Kpi label="Cierre semanal" value={cutoff ? longDateTime(cutoff) : 'Sin fecha'} hint={cutoff && cutoff.getTime() < nowMs() ? 'El plazo ya pasó' : 'Límite para solicitar retención'} tone={!cutoff ? 'warning' : undefined} href="/consolidados" />
      </KpiGrid>

      <div className="stack">
        {steps.map((step) => (
          <Panel key={step.title} title={step.title}>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              {step.items.map((i) => (
                <Link key={i.href} href={i.href} className="glass-panel kpi" style={{ background: 'var(--bg-surface-solid)' }}>
                  <span className="kpi-label">{i.icon} {i.label}</span>
                  <span className="kpi-value" style={i.count > 0 && i.tone ? { color: i.tone === 'warning' ? 'var(--color-warning)' : i.tone === 'success' ? 'var(--color-success)' : 'var(--color-canopy)' } : undefined}>{i.count}</span>
                  <span className="kpi-hint">{i.hint}</span>
                </Link>
              ))}
            </div>
          </Panel>
        ))}
        {warnings > 0 && (
          <div className="alert alert-warning">
            <span>⚠️</span>
            <div><strong>{warnings} consolidado(s) con retención prolongada.</strong> <Link href="/consolidados?vista=retenidos" className="link">Revisarlos</Link> <ToneBadge tone="warning" small>≥ {settings.retentionWarningDays} días</ToneBadge></div>
          </div>
        )}
      </div>
    </>
  );
}
