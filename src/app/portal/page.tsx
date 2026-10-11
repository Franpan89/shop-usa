import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { getClientAccount, countAvailableBenefits } from '@/lib/accounting';
import { getSettings } from '@/lib/tenant';
import { estimateShipping } from '@/lib/consolidation';
import { PRODUCT_STATUS, ORIGIN } from '@/lib/domain/flow';
import { Alert, Empty, Kpi, KpiGrid, Panel, ToneBadge, longDateTime, money, qty, shortDate } from '@/components/ui/kit';
import Thumb from '@/components/ui/Thumb';
import { PortalDecision, TransferButton } from './PortalControls';

import { nowMs } from '@/lib/clock';

export const dynamic = 'force-dynamic';

/** "Mi mercancía": el cliente ve sus productos, su peso, su envío estimado y decide retener o despachar (3.8 / 6.8). */
export default async function PortalHome() {
  const me = await requirePortalClient();
  const settings = await getSettings();

  const [client, account, benefits, products, open, openInvoices, custody] = await Promise.all([
    prisma.client.findUnique({ where: { id: me.id }, include: { shippingCategory: true } }),
    getClientAccount(prisma, me.id),
    countAvailableBenefits(prisma, me.id),
    prisma.product.findMany({
      where: { clientId: me.id, OR: [{ status: { notIn: ['DELIVERED', 'CANCELLED'] } }, { status: 'DELIVERED', deliveredAt: { gte: new Date(nowMs() - 30 * 86_400_000) } }] },
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.consolidation.findFirst({ where: { clientId: me.id, status: 'OPEN' }, include: { products: { where: { status: 'RECEIVED' }, select: { id: true } } } }),
    prisma.invoice.findMany({ where: { clientId: me.id, status: { in: ['PENDING', 'PARTIAL'] } }, orderBy: [{ issueDate: 'asc' }] }),
    prisma.custodyPackage.findMany({ where: { clientId: me.id, status: 'IN_CUSTODY' }, orderBy: { receivedAt: 'desc' } }),
  ]);
  if (!client) return null;

  const est = open ? estimateShipping(open.realWeight, client.shippingCategory) : null;
  const cutoff = settings.dispatchCutoffAt;
  const locked = !!cutoff && cutoff.getTime() < nowMs();

  return (
    <div style={{ padding: 32 }}>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Hola, {client.name.split(' ')[0]}</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>Tu código de casillero es <strong className="mono">{client.code}</strong>. Aquí ves tu mercancía y tu cuenta.</p>

      <KpiGrid>
        <Kpi label="Saldo pendiente" value={money(account.pending)} tone={account.pending > 0.004 ? 'danger' : 'success'} hint={account.pending > 0.004 ? 'Por pagar' : 'Estás al día'} href="/portal/estado-de-cuenta" />
        <Kpi label="Saldo a favor" value={money(account.credit)} tone={account.credit > 0.004 ? 'success' : undefined} hint="Se usa en tu próximo cargo" />
        <Kpi label="Beneficios por referidos" value={benefits} tone={benefits ? 'accent' : undefined} hint={`−${settings.referralDiscountPoints} pts en la tasa de tu próxima factura`} />
      </KpiGrid>

      {account.pending > 0.004 && (
        <Alert tone="warning">
          Tienes <strong>{money(account.pending)}</strong> pendientes.
          <div style={{ marginTop: 8 }}>
            <TransferButton
              invoices={openInvoices.map((i) => ({ id: i.id, label: i.description ?? 'Factura', balance: i.total - i.paidAmount }))}
              defaultAmount={account.pending}
              instructions={settings.paymentInstructions}
              className="btn btn-sm"
            />
          </div>
        </Alert>
      )}

      {open && open.products.length > 0 && (
        <Panel
          title="Mi consolidado abierto"
          subtitle="Toda tu mercancía en bodega se pesa junta. El peso y el valor del envío pueden cambiar si llegan más productos."
          actions={<ToneBadge tone={open.decision === 'HOLD' ? 'warning' : 'info'}>{open.decision === 'HOLD' ? 'Mercancía retenida' : 'Se despacha en el próximo envío'}</ToneBadge>}
        >
          <KpiGrid>
            <Kpi label="Productos" value={open.products.length} />
            <Kpi label="Peso actual" value={open.realWeight > 0 ? `${open.realWeight.toFixed(2)} lb` : 'Por pesar'} />
            <Kpi label="Peso facturable" value={est && est.billableWeight ? `${est.billableWeight} lb` : '—'} hint={client.shippingCategory?.unit === 'LB' ? 'Se cobra por libra completa' : 'Se cobra en fracciones de 0.5 lb'} />
            <Kpi label="Valor estimado de envío" value={est?.cost != null && open.realWeight > 0 ? money(est.cost) : '—'} tone="accent" hint={client.shippingCategory ? `${client.shippingCategory.name} · $${client.shippingCategory.pricePerLb.toFixed(2)}/lb` : 'Tarifa por asignar'} />
          </KpiGrid>
          <div className="stack-sm">
            <PortalDecision consolidationId={open.id} decision={open.decision} locked={locked} />
            <div className="muted small">
              {cutoff ? (locked ? 'El cierre semanal ya pasó.' : <>Solicita la retención de tu mercancía antes del <strong>{longDateTime(cutoff)}</strong>. Si no lo haces, se despacha.</>) : 'Si no solicitas retención, tu mercancía continúa al despacho.'}
            </div>
            <div className="muted small">La mercancía podrá mantenerse en consolidación por un período máximo aproximado de {settings.retentionMaxDays} días. Una vez alcanzado, Shop USA podrá solicitar el despacho para evitar acumulaciones prolongadas en bodega.</div>
          </div>
        </Panel>
      )}

      <div style={{ height: 20 }} />
      <Panel title="Mi mercancía" subtitle="El estado de cada uno de tus productos." flush>
        {products.length === 0 ? (
          <Empty icon="📦" title="Todavía no tienes mercancía">Cuando hagas un pedido o llegue un paquete a tu casillero aparecerá aquí.</Empty>
        ) : (
          <div style={{ paddingBottom: 6 }}>
            {products.map((p) => (
              <div key={p.id} className="group-row">
                <Thumb src={p.imageUrl} alt={p.name} />
                <div className="grow">
                  <div className="strong">{qty(p.name, p.quantity)}</div>
                  <div className="muted small">{ORIGIN[p.origin].icon} {ORIGIN[p.origin].label}{p.status === 'DELIVERED' ? ` · entregado ${shortDate(p.deliveredAt)}` : ''}</div>
                </div>
                <ToneBadge tone={PRODUCT_STATUS[p.status].tone} small>{PRODUCT_STATUS[p.status].clientLabel}</ToneBadge>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {client.custodyActive && (
        <>
          <div style={{ height: 20 }} />
          <Panel title="Custodio de paquetería en Orlando" subtitle={client.custodyDeadline ? `Servicio activo hasta ${shortDate(client.custodyDeadline)}` : undefined}>
            {custody.length === 0 ? <p className="muted small">No tienes paquetes en custodia.</p> : (
              <div className="stack-sm small">
                {custody.map((c) => (<div key={c.id} className="row-between"><span>{c.storeNote ?? 'Paquete'} · recibido {shortDate(c.receivedAt)}</span><strong>{money(c.fee)}</strong></div>))}
              </div>
            )}
          </Panel>
        </>
      )}
      <p className="muted small" style={{ marginTop: 20 }}><Link href="/portal/pedidos" className="link">Ver mis pedidos</Link> · <Link href="/portal/estado-de-cuenta" className="link">Ver mi estado de cuenta</Link></p>
    </div>
  );
}
