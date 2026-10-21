import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requirePortalClient } from '@/lib/auth';
import { getSettings } from '@/lib/tenant';
import { ORDER_STATUS, ORDER_STEPS, ORDER_TYPE, PRODUCT_STATUS, orderStepIndex } from '@/lib/domain/flow';
import { invoiceBalanceOf, invoiceCode, orderCode } from '@/lib/logistics';
import { Alert, Panel, Stepper, StatusBadge, ToneBadge, money, qty, shortDate } from '@/components/ui/kit';
import Thumb from '@/components/ui/Thumb';
import { isSquareConfigured } from '@/lib/square';
import { PayActions } from '../../PortalControls';

export const dynamic = 'force-dynamic';

/** Resumen claro antes de pagar (2.6): productos, tax, servicio, descuento y total. */
export default async function PortalPedidoDetalle({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePortalClient();
  const { id } = await params;
  const settings = await getSettings();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { products: { orderBy: { createdAt: 'asc' } }, invoice: true },
  });
  // La propiedad se valida con la sesión.
  if (!order || order.clientId !== me.id) notFound();

  const pending = order.invoice
    ? await prisma.payment.count({ where: { clientId: me.id, status: 'PENDING_VERIFICATION', OR: [{ targetInvoiceId: order.invoice.id }, { targetInvoiceId: null }] } })
    : 0;
  const balance = invoiceBalanceOf(order.invoice);
  const serviceLabel = order.type === 'CART' ? 'Servicio Compramos tu carrito' : 'Servicio Personal Shopper';

  return (
    <div>
      <Link href="/portal/pedidos" className="back-link">← Mis pedidos</Link>
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ fontSize: '2rem' }}>Pedido {orderCode(order.number)}</h1>
        <StatusBadge meta={ORDER_STATUS[order.status]} />
        <ToneBadge tone="secondary">{ORDER_TYPE[order.type].icon} {ORDER_TYPE[order.type].label}</ToneBadge>
      </div>

      {order.status !== 'CANCELLED' && <div className="glass-panel static panel" style={{ marginBottom: 20 }}><Stepper steps={ORDER_STEPS} current={orderStepIndex(order.status)} /></div>}
      {order.status === 'PENDING_PAYMENT' && <Alert tone="warning"><strong>Pendiente de pago.</strong> Realizamos la compra cuando tu pago esté aprobado.</Alert>}
      {order.status === 'PAYMENT_REVIEW' && <Alert tone="info">Recibimos tu comprobante y lo estamos verificando.</Alert>}

      <div className="page-grid">
        <Panel title="Productos" flush>
          <div style={{ paddingBottom: 6 }}>
            {order.products.map((p) => (
              <div key={p.id} className="group-row">
                <Thumb src={p.imageUrl} alt={p.name} />
                <div className="grow">
                  <div className="strong">{qty(p.name, p.quantity)}</div>
                  <div className="muted small">{[p.storeName, p.variant].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="strong">{money((p.unitPrice ?? 0) * p.quantity)}</div>
                <ToneBadge tone={PRODUCT_STATUS[p.status].tone} small>{PRODUCT_STATUS[p.status].clientLabel}</ToneBadge>
              </div>
            ))}
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Resumen">
            <dl className="summary">
              <dt>Subtotal</dt><dd>{money(order.subtotal)}</dd>
              <dt>Tax {order.taxRatePercent}%</dt><dd>{money(order.taxAmount)}</dd>
              <dt className="strong">Total factura</dt><dd>{money(order.subtotal + order.taxAmount)}</dd>
              <dt>{serviceLabel} {order.serviceFeePercent}%</dt><dd>{money(order.serviceFeeAmount)}</dd>
              {order.extraCharges > 0 && (<><dt>{order.extraChargesNote || 'Otros costos'}</dt><dd>{money(order.extraCharges)}</dd></>)}
              <dt>Descuento</dt><dd>{order.discountAmount > 0 ? `-${money(order.discountAmount)}` : '$0.00'}</dd>
              <dt className="total-label">TOTAL A PAGAR</dt><dd className="total">{money(order.totalAmount)}</dd>
            </dl>
            {order.invoice && !order.cancelledAt && (
              <div className="stack-sm" style={{ marginTop: 16 }}>
                <div className="row-between"><span className="muted">Pagado</span><strong className="money-ok">{money(order.invoice.paidAmount)}</strong></div>
                <div className="row-between"><span className="muted">Pendiente ({invoiceCode(order.invoice.number)})</span><strong className={balance > 0.004 ? 'money-due' : 'money-ok'}>{money(balance)}</strong></div>
                {balance > 0.004 && (
                  <PayActions
                    invoices={[{ id: order.invoice.id, label: `Pedido ${orderCode(order.number)}`, balance }]}
                    defaultInvoiceId={order.invoice.id}
                    pendingTotal={balance}
                    instructions={settings.paymentInstructions}
                    cardEnabled={isSquareConfigured()}
                  />
                )}
                {pending > 0 && <span className="muted small">Tienes un comprobante en verificación desde {shortDate(new Date())}.</span>}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
