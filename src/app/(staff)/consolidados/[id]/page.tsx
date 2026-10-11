import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/tenant';
import { estimateShipping } from '@/lib/consolidation';
import { consolidationLabel, isDispatchAuthorized, ORIGIN, PRODUCT_STATUS, retentionDays, retentionLevel } from '@/lib/domain/flow';
import { getCountryRuleMap, invoiceBalanceOf, invoiceCode, pkgCode } from '@/lib/logistics';
import { Alert, AuthPill, Kpi, KpiGrid, PageHeader, Panel, StatusBadge, money, qty, shortDate } from '@/components/ui/kit';
import Thumb from '@/components/ui/Thumb';
import { CloseButton, DecisionToggle, ReopenButton, WeightEditor } from '../ConsolidationControls';

export const dynamic = 'force-dynamic';

export default async function ConsolidationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;

  const c = await prisma.consolidation.findUnique({
    where: { id },
    include: {
      client: { include: { shippingCategory: true } },
      products: { where: { status: { not: 'CANCELLED' } }, include: { pkg: { select: { id: true, number: true } }, order: { select: { id: true, number: true } } }, orderBy: [{ origin: 'asc' }, { createdAt: 'asc' }] },
      invoice: { include: { lines: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!c) notFound();

  const settings = await getSettings();
  const { ruleFor } = await getCountryRuleMap();
  const rule = ruleFor(c.client.country);
  const closed = c.status === 'CLOSED';
  const est = estimateShipping(c.realWeight, c.client.shippingCategory);
  const held = !closed && c.decision === 'HOLD';
  const days = held ? retentionDays(c.retentionStartedAt) : 0;
  const level = retentionLevel(days, held, settings.retentionWarningDays, settings.retentionMaxDays);
  const balance = invoiceBalanceOf(c.invoice);
  const dispatchOk = isDispatchAuthorized(balance, rule);
  const units = c.products.reduce((s, p) => s + p.quantity, 0);

  const reason = !c.client.shippingCategory ? 'El cliente no tiene tarifa de envío' : c.realWeight <= 0 ? 'Registra el peso primero' : c.products.length === 0 ? 'Sin productos' : undefined;
  const byOrigin = (['PERSONAL_SHOPPER', 'CART', 'CASILLERO'] as const).map((o) => ({ origin: o, items: c.products.filter((p) => p.origin === o) })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        back={{ href: '/consolidados', label: 'Consolidados' }}
        title={c.client.name}
        badges={<><span className="badge badge-accent mono">{c.client.code}</span><StatusBadge meta={consolidationLabel(c.status, c.decision)} /></>}
        subtitle={`${c.client.country} · ${c.products.length} producto(s) (${units} unidades) · abierto desde ${shortDate(c.createdAt)}`}
        actions={
          <>
            <Link href={`/clientes/${c.clientId}`} className="btn btn-secondary btn-sm">Ver cliente</Link>
            {!closed && c.decision === 'DISPATCH' && <CloseButton consolidationId={c.id} disabledReason={reason} />}
            {closed && user.role === 'ADMIN' && <ReopenButton consolidationId={c.id} />}
          </>
        }
      />

      {level === 'warning' && <Alert tone="warning">⚠️ <strong>Retención prolongada:</strong> lleva {days} días retenida (política: hasta {settings.retentionMaxDays} días). El sistema no bloquea ni despacha por su cuenta: la decisión es de Shop USA.</Alert>}
      {level === 'overdue' && <Alert tone="danger">⚠️ <strong>Superó los {settings.retentionMaxDays} días de retención</strong> ({days} días). Considera solicitar el despacho al cliente.</Alert>}
      {!c.client.shippingCategory && <Alert tone="warning">El cliente no tiene tarifa de envío asignada. <Link href={`/clientes/${c.clientId}`} className="link">Asígnala en su ficha</Link> para calcular el envío.</Alert>}

      <KpiGrid>
        <Kpi label="Peso real" value={`${(closed ? c.realWeight : c.realWeight).toFixed(2)} lb`} hint={closed ? 'Congelado al cerrar' : 'Editable hasta cerrar'} />
        <Kpi label="Peso facturable" value={`${closed ? c.billableWeight ?? 0 : est.billableWeight} lb`} hint={c.client.shippingCategory ? (c.client.shippingCategory.unit === 'LB' ? 'Libra completa' : 'Fracciones de 0.5 lb') : undefined} />
        <Kpi label={closed ? 'Valor del envío' : 'Valor estimado del envío'} value={closed ? money(c.shippingCost ?? 0) : est.cost != null && c.realWeight > 0 ? money(est.cost) : '—'} tone="accent" hint={`${closed ? c.shippingCategoryName : est.categoryName ?? 'Sin tarifa'}${(closed ? c.pricePerLb : est.pricePerLb) ? ` · $${(closed ? c.pricePerLb : est.pricePerLb)!.toFixed(2)}/lb` : ''}`} />
        {held && <Kpi label="Retención" value={`${days} d`} tone={level === 'ok' ? undefined : 'warning'} hint={`Desde ${shortDate(c.retentionStartedAt)} (no se reinicia)`} />}
      </KpiGrid>

      <div className="page-grid">
        <div className="stack">
          {!closed && (
            <Panel title="Peso consolidado" subtitle="Coloca toda la mercancía del cliente junta en la balanza. Cada vez que lleguen productos nuevos, vuelve a pesar y reemplaza el valor.">
              <div className="row-between">
                <WeightEditor consolidationId={c.id} weight={c.realWeight} big />
                <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                  <span className="muted small">Decisión del cliente (por defecto: despachar)</span>
                  <DecisionToggle consolidationId={c.id} decision={c.decision} />
                </div>
              </div>
            </Panel>
          )}

          {byOrigin.map((g) => (
            <Panel key={g.origin} title={`${ORIGIN[g.origin].icon} ${ORIGIN[g.origin].label} (${g.items.length})`} flush>
              <div style={{ padding: '0 0 6px' }}>
                {g.items.map((p) => (
                  <div key={p.id} className="group-row">
                    <Thumb src={p.imageUrl} alt={p.name} />
                    <div className="grow">
                      <div className="strong">{qty(p.name, p.quantity)}</div>
                      <div className="muted small">
                        {p.order ? <Link href={`/pedidos/${p.order.id}`} className="link">Pedido #{String(p.order.number).padStart(3, '0')}</Link> : 'Recibido directo'}
                        {' · '}llegó {shortDate(p.receivedAt)}
                      </div>
                    </div>
                    {p.pkg && <Link href={`/cajas/${p.pkg.id}`} className="badge badge-info mono">{pkgCode(p.pkg.number)}</Link>}
                    <StatusBadge meta={PRODUCT_STATUS[p.status]} small />
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <div className="stack">
          {closed && c.invoice && (
            <Panel title="Factura de despacho" subtitle={`${invoiceCode(c.invoice.number)} · cerrada ${shortDate(c.closedAt)}`}>
              <dl className="summary">
                {c.invoice.lines.map((l) => (
                  <div key={l.id} style={{ display: 'contents' }}><dt>{l.description}</dt><dd>{money(l.amount)}</dd></div>
                ))}
                <dt className="total-label">Total</dt><dd className="total">{money(c.invoice.total)}</dd>
                <dt>Pagado</dt><dd className="money-ok">{money(c.invoice.paidAmount)}</dd>
                <dt>Saldo</dt><dd className={balance > 0.004 ? 'money-due' : 'money-ok'}>{money(balance)}</dd>
              </dl>
              <div className="stack-sm" style={{ marginTop: 14 }}>
                <AuthPill ok={dispatchOk} okLabel="Autorizado para despacho" noLabel="No autorizado para despacho" />
                {!rule.allowDispatchWithBalance && !dispatchOk && <span className="muted small">{c.client.country} exige la factura completamente pagada antes de despachar.</span>}
                {rule.allowDispatchWithBalance && balance > 0.004 && <span className="muted small">Puede despacharse, pero <strong>no entregarse</strong> en destino mientras tenga saldo.</span>}
                <Link href={`/clientes/${c.clientId}/estado-de-cuenta`} className="link small">Ver estado de cuenta →</Link>
              </div>
            </Panel>
          )}
          <Panel title="Reglas de este consolidado">
            <ul className="muted small" style={{ paddingLeft: 18, display: 'grid', gap: 8 }}>
              <li>Personal Shopper, Casillero y Carrito comparten <strong>un solo consolidado</strong> y un solo peso.</li>
              <li>Retener mantiene el consolidado abierto; la fecha de inicio de retención <strong>no se reinicia</strong> con productos nuevos.</li>
              <li>Al cerrar se guardan peso, tarifa y valor: no cambian aunque después cambie la tarifa.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
