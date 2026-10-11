import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/auth';
import { signedProofUrls } from '@/lib/storage';
import { ORDER_STATUS, ORDER_STEPS, ORDER_TYPE, PAYMENT_METHOD_LABEL, PRODUCT_STATUS, PRODUCT_STATUS_RANK, orderStepIndex } from '@/lib/domain/flow';
import { orderSummaryText } from '@/lib/domain/summary';
import { invoiceBalanceOf, invoiceCode, orderCode } from '@/lib/logistics';
import { Alert, Empty, PageHeader, Panel, Stepper, StatusBadge, ToneBadge, longDateTime, money, qty, shortDate } from '@/components/ui/kit';
import Thumb from '@/components/ui/Thumb';
import CopyButton from '@/components/ui/CopyButton';
import PaymentReview from '@/components/finance/PaymentReview';
import { RegisterPaymentModal } from '@/components/finance/FinanceModals';
import { CancelOrderButton, CourtesyButton, PurchaseAllButton, PurchaseButton } from './OrderActions';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, code: true, country: true } },
      products: { orderBy: { createdAt: 'asc' } },
      invoice: { include: { lines: { orderBy: { sortOrder: 'asc' } }, allocations: { include: { payment: true } } } },
      benefitUsed: { select: { id: true } },
    },
  });
  if (!order) notFound();

  const [pending, history] = await Promise.all([
    prisma.payment.findMany({
      where: {
        clientId: order.clientId,
        status: 'PENDING_VERIFICATION',
        OR: order.invoice ? [{ targetInvoiceId: order.invoice.id }, { targetInvoiceId: null }] : undefined,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({ where: { entity: 'Order', entityId: id }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);
  const proofs = await signedProofUrls(pending.map((p) => p.proofUrl));

  const invoice = order.invoice;
  const balance = invoiceBalanceOf(invoice);
  const paid = invoice ? invoice.paidAmount : 0;
  const live = order.products.filter((p) => p.status !== 'CANCELLED');
  const readyToBuy = live.filter((p) => p.status === 'READY_TO_BUY');
  const editable = !order.cancelledAt && !order.products.some((p) => PRODUCT_STATUS_RANK[p.status] >= PRODUCT_STATUS_RANK.PURCHASED);
  const serviceLabel = order.type === 'CART' ? 'Servicio Compramos tu carrito' : 'Servicio Personal Shopper';

  const summary = orderSummaryText({
    code: orderCode(order.number),
    clientName: order.client.name,
    typeLabel: ORDER_TYPE[order.type].label,
    items: order.products.filter((p) => p.status !== 'CANCELLED').map((p) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice ?? 0 })),
    subtotal: order.subtotal,
    taxRatePercent: order.taxRatePercent,
    tax: order.taxAmount,
    serviceLabel,
    serviceRatePercent: order.serviceFeePercent,
    serviceFee: order.serviceFeeAmount,
    extraCharges: order.extraCharges,
    extraChargesNote: order.extraChargesNote,
    discountAmount: order.discountAmount,
    total: order.totalAmount,
  });

  return (
    <>
      <PageHeader
        back={{ href: '/pedidos', label: 'Pedidos' }}
        title={`Pedido ${orderCode(order.number)}`}
        badges={<><StatusBadge meta={ORDER_STATUS[order.status]} /><ToneBadge tone="secondary">{ORDER_TYPE[order.type].icon} {ORDER_TYPE[order.type].label}</ToneBadge></>}
        subtitle={<><Link href={`/clientes/${order.client.id}`} className="link">{order.client.name}</Link> · <span className="mono">{order.client.code}</span> · {shortDate(order.orderDate)}{order.channel ? ` · vía ${order.channel}` : ''}</>}
        actions={
          <>
            <CopyButton text={summary} />
            {editable && <Link href={`/pedidos/${id}/editar`} className="btn btn-secondary btn-sm">✏️ Editar</Link>}
            {editable && <CancelOrderButton orderId={id} />}
          </>
        }
      />

      {order.status !== 'CANCELLED' && (
        <div className="glass-panel static panel" style={{ marginBottom: 20 }}>
          <Stepper steps={ORDER_STEPS} current={orderStepIndex(order.status)} />
        </div>
      )}

      {order.status === 'CANCELLED' && <Alert tone="danger">Pedido cancelado{order.cancelReason ? `: ${order.cancelReason}` : ''}. Los pagos aplicados volvieron al saldo a favor del cliente.</Alert>}
      {order.status === 'PENDING_PAYMENT' && <Alert tone="warning"><strong>Pendiente de pago.</strong> Shop USA no adelanta dinero: no compres estos productos hasta que el pago esté aprobado.</Alert>}
      {order.status === 'PAYMENT_REVIEW' && <Alert tone="info"><strong>Hay un comprobante por verificar.</strong> Confirma que el dinero esté en la cuenta y aprueba el pago más abajo.</Alert>}
      {order.courtesyAuthorized && <Alert tone="success"><strong>Compra autorizada a crédito</strong> por {order.courtesyAuthorizedBy} el {shortDate(order.courtesyAuthorizedAt)}. El saldo pendiente queda como cargo en la cuenta del cliente.</Alert>}
      {order.benefitUsed && <Alert tone="info">🎁 Esta factura usó un <strong>beneficio por referido</strong>: tasa de servicio {order.serviceFeePercent}% en lugar de {order.baseServiceFeePercent}%.</Alert>}

      <div className="page-grid">
        <div className="stack">
          <Panel
            title={`Productos (${live.length})`}
            subtitle="Se compran por producto: no hace falta marcar todo el pedido a la vez."
            actions={readyToBuy.length > 1 ? <PurchaseAllButton productIds={readyToBuy.map((p) => p.id)} /> : undefined}
            flush
          >
            <div className="table-container" style={{ padding: '0 16px 16px' }}>
              <table className="data-table compact">
                <thead>
                  <tr><th /><th>PRODUCTO</th><th className="text-right">PRECIO</th><th className="text-right">SUBTOTAL</th><th>ESTADO</th><th /></tr>
                </thead>
                <tbody>
                  {order.products.map((p) => (
                    <tr key={p.id} style={p.status === 'CANCELLED' ? { opacity: 0.5 } : undefined}>
                      <td><Thumb src={p.imageUrl} alt={p.name} /></td>
                      <td>
                        <div className="strong">{qty(p.name, p.quantity)}</div>
                        <div className="muted small">
                          {[p.storeName, p.variant, p.notes].filter(Boolean).join(' · ')}
                          {p.url && <> · <a href={p.url} target="_blank" rel="noreferrer" className="link">ver link</a></>}
                        </div>
                      </td>
                      <td className="text-right">{money(p.unitPrice ?? 0)}</td>
                      <td className="text-right strong">{money((p.unitPrice ?? 0) * p.quantity)}</td>
                      <td><StatusBadge meta={PRODUCT_STATUS[p.status]} small /></td>
                      <td className="nowrap">
                        {p.status === 'READY_TO_BUY' && <PurchaseButton productId={p.id} purchased={false} />}
                        {p.status === 'PURCHASED' && <PurchaseButton productId={p.id} purchased />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {order.products.length === 0 && <Empty icon="📦" title="Sin productos" />}
            </div>
          </Panel>

          {pending.length > 0 && (
            <Panel title="Comprobantes por verificar" subtitle="El comprobante no significa que el dinero llegó: verifícalo en la cuenta antes de aprobar.">
              <div className="stack">
                {pending.map((p) => (
                  <div key={p.id} className="group-card" style={{ padding: 16 }}>
                    <div className="row-between">
                      <div className="row">
                        {p.proofUrl && proofs.get(p.proofUrl) ? (
                          <a href={proofs.get(p.proofUrl)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">📎 Ver comprobante</a>
                        ) : (
                          <span className="muted small">Sin comprobante</span>
                        )}
                        <div>
                          <div className="strong">{money(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}</div>
                          <div className="muted small">{shortDate(p.paidAt)}{p.reference ? ` · ref. ${p.reference}` : ''} · enviado {longDateTime(p.createdAt)}</div>
                        </div>
                      </div>
                      <PaymentReview paymentId={p.id} amount={p.amount} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {history.length > 0 && (
            <Panel title="Historial">
              <div className="stack-sm small">
                {history.map((h) => (
                  <div key={h.id} className="row-between">
                    <span>{h.action}{h.userName ? <span className="muted"> · {h.userName}</span> : null}</span>
                    <span className="muted">{longDateTime(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="Resumen para el cliente">
            <dl className="summary">
              <dt>Subtotal productos</dt><dd>{money(order.subtotal)}</dd>
              <dt>Tax {order.taxRatePercent}%</dt><dd>{money(order.taxAmount)}</dd>
              <dt className="strong">Total factura</dt><dd>{money(order.subtotal + order.taxAmount)}</dd>
              <dt>{serviceLabel} {order.serviceFeePercent}%</dt><dd>{money(order.serviceFeeAmount)}</dd>
              {order.extraCharges > 0 && (<><dt>{order.extraChargesNote || 'Otros costos'}</dt><dd>{money(order.extraCharges)}</dd></>)}
              <dt>Descuento{order.discountReason ? ` (${order.discountReason})` : ''}</dt><dd>{order.discountAmount > 0 ? `-${money(order.discountAmount)}` : '$0.00'}</dd>
              <dt className="total-label">TOTAL A PAGAR</dt><dd className="total">{money(order.totalAmount)}</dd>
            </dl>
          </Panel>

          <Panel title="Pago" subtitle={invoice ? `${invoiceCode(invoice.number)} · cuenta del cliente` : undefined}>
            <div className="stack-sm">
              <div className="row-between"><span className="muted">Pagado</span><strong className="money-ok">{money(paid)}</strong></div>
              <div className="row-between"><span className="muted">Saldo pendiente</span><strong className={balance > 0.004 ? 'money-due' : 'money-ok'}>{money(balance)}</strong></div>
              {invoice && invoice.allocations.length > 0 && (
                <div className="muted small">
                  {invoice.allocations.map((a) => (
                    <div key={a.id}>{shortDate(a.payment.paidAt)} · {money(a.amount)} · {PAYMENT_METHOD_LABEL[a.payment.method]}</div>
                  ))}
                </div>
              )}
              {!order.cancelledAt && balance > 0.004 && invoice && (
                <div className="row" style={{ marginTop: 6 }}>
                  <RegisterPaymentModal
                    clientId={order.clientId}
                    invoices={[{ id: invoice.id, label: `${invoiceCode(invoice.number)} — este pedido`, balance }]}
                    defaultTargetId={invoice.id}
                    trigger="💳 Registrar pago"
                    triggerClassName="btn btn-sm"
                  />
                  {user.role === 'ADMIN' && editable && <CourtesyButton orderId={id} authorized={order.courtesyAuthorized} />}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
