import 'server-only';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { createPayment, getClientAccount, refreshClientOrders } from '@/lib/accounting';
import { toCents } from '@/lib/domain/money';
import { sendPaymentApprovedEmail } from '@/lib/email';
import { getOrder } from '@/lib/square';
import { audit, inTransaction } from '@/lib/tenant';

export type CardCheckoutOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'NOT_FOUND';

/**
 * Convierte un cobro de Square en un pago de la cuenta del cliente. Se llama desde dos lugares
 * (el regreso del cliente a su portal y el webhook de Square) y es seguro repetirlo:
 *  - consulta a Square el estado real de la orden (no confía en quien la invoca),
 *  - exige que el monto cobrado sea exactamente el que pedimos,
 *  - "reclama" el cobro con un UPDATE condicional, así dos llamadas simultáneas crean un solo pago.
 */
export async function finalizeCardCheckout(checkoutId: string): Promise<CardCheckoutOutcome> {
  const checkout = await prisma.cardCheckout.findUnique({ where: { id: checkoutId }, include: { client: { select: { name: true, email: true } } } });
  if (!checkout) return 'NOT_FOUND';
  if (checkout.status === 'PAID') return 'PAID';
  if (checkout.status === 'FAILED' || !checkout.squareOrderId) return 'FAILED';

  const order = await getOrder(checkout.squareOrderId);
  if (order.state === 'CANCELED') {
    await prisma.cardCheckout.updateMany({ where: { id: checkout.id, status: 'CREATED' }, data: { status: 'FAILED' } });
    return 'FAILED';
  }
  if (!order.paid) return 'PENDING';
  if (order.currency !== 'USD' || order.totalCents !== toCents(checkout.amount)) {
    console.error('[square] monto inesperado', { checkout: checkout.id, esperado: toCents(checkout.amount), recibido: order.totalCents, moneda: order.currency });
    return 'PENDING';
  }

  const created = await inTransaction(async (tx) => {
    const claimed = await tx.cardCheckout.updateMany({
      where: { id: checkout.id, status: 'CREATED' },
      data: { status: 'PAID', paidAt: new Date(), squarePaymentId: order.paymentId },
    });
    if (claimed.count !== 1) return null; // otra llamada ya lo registró
    const payment = await createPayment(tx, {
      tenantId: checkout.tenantId,
      clientId: checkout.clientId,
      amount: checkout.amount,
      method: 'CARD',
      source: 'CLIENT',
      reference: order.paymentId ?? undefined,
      note: 'Pago con tarjeta (Square)',
      targetInvoiceId: checkout.targetInvoiceId,
      approved: true,
      verifiedBy: 'Square',
    });
    await tx.cardCheckout.update({ where: { id: checkout.id }, data: { paymentId: payment.id } });
    await refreshClientOrders(tx, checkout.clientId);
    await audit(tx, { userName: `Cliente ${checkout.client.name}`, action: 'payment.card', entity: 'Payment', entityId: payment.id, data: { amount: checkout.amount } });
    return payment;
  });

  if (created) {
    if (checkout.client.email) {
      const acc = await getClientAccount(prisma, checkout.clientId);
      await sendPaymentApprovedEmail({ to: checkout.client.email, clientName: checkout.client.name, amount: created.amount, credit: acc.credit });
    }
    revalidatePath('/pagos');
    revalidatePath('/pedidos');
    revalidatePath('/compras');
    revalidatePath('/dashboard');
    revalidatePath(`/clientes/${checkout.clientId}`);
    revalidatePath('/portal', 'layout');
  }
  return 'PAID';
}
